import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Location, Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CamerasService } from '../cameras/cameras.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

// Campos retornados em listagens. Exclui `floorPlans` (data URLs das plantas,
// potencialmente grandes) — elas só são necessárias no mapa da construção
// (`findOne`/`getBuilding`), não em `GET /locations`.
const locationSummarySelect = {
  id: true,
  tenantUuid: true,
  name: true,
  description: true,
  latitude: true,
  longitude: true,
  isBuilding: true,
  floorsCount: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LocationSelect;

// Limite total das plantas de uma construção (soma dos data URLs).
const MAX_FLOOR_PLANS_CHARS = 8 * 1024 * 1024;

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cameras: CamerasService,
  ) {}

  async findAll(tenantUuid: string) {
    return this.prisma.location.findMany({
      where: { tenantUuid },
      orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
      select: locationSummarySelect,
    });
  }

  async findOne(id: string, tenantUuid: string): Promise<Location> {
    const location = await this.prisma.location.findFirst({
      where: { id, tenantUuid },
    });
    if (!location) throw new NotFoundException(`Location ${id} not found`);
    return location;
  }

  /**
   * Retorna a localização com lixeiras, câmeras e tarefas agrupadas por andar,
   * para o front desenhar o "mapa da construção" com a mesma riqueza do mapa
   * principal. Andares são ordenados pelo rótulo; itens sem andar definido
   * (`floor` nulo) vêm por último.
   */
  async getBuilding(id: string, tenantUuid: string) {
    const location = await this.findOne(id, tenantUuid);

    const [bins, cameras, tasks] = await Promise.all([
      this.prisma.trashBin.findMany({
        where: { locationId: id, tenantUuid },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          fillLevel: true,
          floor: true,
          posX: true,
          posY: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.cameras.findByLocation(id, tenantUuid),
      // Tarefas posicionadas na planta (com posX/posY próprios) e ainda abertas,
      // espelhando a regra do mapa principal (findMapTasks).
      this.prisma.task.findMany({
        where: {
          locationId: id,
          tenantUuid,
          posX: { not: null },
          posY: { not: null },
          status: { in: [TaskStatus.pending, TaskStatus.in_progress] },
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          assigneeRole: true,
          assigneeName: true,
          floor: true,
          posX: true,
          posY: true,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    // Conjunto de andares presente em qualquer um dos três tipos.
    const floorKeys = new Set<string | null>();
    for (const bin of bins) floorKeys.add(bin.floor ?? null);
    for (const camera of cameras) floorKeys.add(camera.floor ?? null);
    for (const task of tasks) floorKeys.add(task.floor ?? null);

    const floors = [...floorKeys]
      .sort((a, b) => {
        if (a === null) return 1;
        if (b === null) return -1;
        return a.localeCompare(b, 'pt-BR', { numeric: true });
      })
      .map((floor) => ({
        floor,
        bins: bins.filter((b) => (b.floor ?? null) === floor),
        cameras: cameras.filter((c) => (c.floor ?? null) === floor),
        tasks: tasks.filter((t) => (t.floor ?? null) === floor),
      }));

    return { ...location, floors };
  }

  // Garante que `floorPlans` é um mapa "andar -> string" dentro do limite de
  // tamanho. O DTO só valida que é objeto; aqui protegemos o banco de payloads
  // inválidos/enormes vindos direto da API (o front já limita cada imagem).
  private assertValidFloorPlans(
    floorPlans: Record<string, string> | null | undefined,
  ): void {
    if (!floorPlans) return;
    let total = 0;
    for (const [floor, value] of Object.entries(floorPlans)) {
      if (typeof value !== 'string') {
        throw new BadRequestException(`Planta do andar "${floor}" inválida.`);
      }
      total += value.length;
    }
    if (total > MAX_FLOOR_PLANS_CHARS) {
      throw new BadRequestException(
        'As plantas excedem o tamanho máximo permitido para a construção.',
      );
    }
  }

  async create(dto: CreateLocationDto, tenantUuid: string): Promise<Location> {
    this.assertValidFloorPlans(dto.floorPlans);
    return this.prisma.location.create({
      data: {
        tenantUuid,
        name: dto.name,
        description: dto.description ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isBuilding: dto.isBuilding ?? false,
        floorsCount: dto.floorsCount ?? null,
        floorPlans: dto.floorPlans ?? undefined,
      },
    });
  }

  async update(id: string, dto: UpdateLocationDto, tenantUuid: string): Promise<Location> {
    await this.findOne(id, tenantUuid);
    this.assertValidFloorPlans(dto.floorPlans);

    const data: Prisma.LocationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.isBuilding !== undefined) data.isBuilding = dto.isBuilding;
    if (dto.floorsCount !== undefined) data.floorsCount = dto.floorsCount ?? null;
    if (dto.floorPlans !== undefined) {
      data.floorPlans = dto.floorPlans ?? Prisma.DbNull;
    }

    return this.prisma.location.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, tenantUuid: string): Promise<{ id: string }> {
    await this.findOne(id, tenantUuid);
    try {
      await this.prisma.location.delete({ where: { id } });
      return { id };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new ConflictException('Esta localização está vinculada a uma lixeira.');
      }
      throw err;
    }
  }
}
