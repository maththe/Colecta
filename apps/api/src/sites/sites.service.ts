import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Site } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantUuid: string): Promise<Site[]> {
    return this.prisma.site.findMany({
      where: { tenantUuid },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, tenantUuid: string): Promise<Site> {
    const site = await this.prisma.site.findFirst({ where: { id, tenantUuid } });
    if (!site) throw new NotFoundException(`Site ${id} not found`);
    return site;
  }

  async create(dto: CreateSiteDto, tenantUuid: string): Promise<Site> {
    assertValidBoundary(dto.boundary);
    return this.prisma.site.create({
      data: {
        tenantUuid,
        name: dto.name,
        boundary: (dto.boundary as Prisma.InputJsonValue) ?? undefined,
        baseMode: dto.baseMode,
        centerLat: dto.centerLat ?? null,
        centerLng: dto.centerLng ?? null,
        defaultZoom: dto.defaultZoom ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateSiteDto, tenantUuid: string): Promise<Site> {
    await this.findOne(id, tenantUuid);
    assertValidBoundary(dto.boundary);

    const data: Prisma.SiteUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.baseMode !== undefined) data.baseMode = dto.baseMode;
    if (dto.centerLat !== undefined) data.centerLat = dto.centerLat ?? null;
    if (dto.centerLng !== undefined) data.centerLng = dto.centerLng ?? null;
    if (dto.defaultZoom !== undefined) data.defaultZoom = dto.defaultZoom ?? null;
    if (dto.boundary !== undefined) {
      data.boundary = (dto.boundary as Prisma.InputJsonValue) ?? Prisma.DbNull;
    }

    return this.prisma.site.update({ where: { id }, data });
  }

  async remove(id: string, tenantUuid: string): Promise<{ id: string }> {
    await this.findOne(id, tenantUuid);
    try {
      await this.prisma.site.delete({ where: { id } });
      return { id };
    } catch (err) {
      // FK Restrict: o Site ainda tem construções/lixeiras/câmeras/tarefas.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new ConflictException(
          'Este recinto possui recursos vinculados. Reatribua-os antes de excluir.',
        );
      }
      throw err;
    }
  }
}

// Validação leve do GeoJSON do contorno: precisa ser Polygon/MultiPolygon (ou um
// Feature que os embrulhe) com `coordinates`. O recorte fino fica no front/Turf.
function assertValidBoundary(boundary: unknown): void {
  if (boundary === undefined || boundary === null) return;
  if (typeof boundary !== 'object') {
    throw new BadRequestException('boundary deve ser um objeto GeoJSON.');
  }
  const geometry = unwrapFeature(boundary as Record<string, unknown>);
  const type = geometry.type;
  if (type !== 'Polygon' && type !== 'MultiPolygon') {
    throw new BadRequestException(
      'boundary deve ser um GeoJSON Polygon ou MultiPolygon.',
    );
  }
  if (!Array.isArray(geometry.coordinates)) {
    throw new BadRequestException('boundary.coordinates inválido.');
  }
}

function unwrapFeature(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj.type === 'Feature' && obj.geometry && typeof obj.geometry === 'object') {
    return obj.geometry as Record<string, unknown>;
  }
  return obj;
}
