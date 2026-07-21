import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskStatus, UserRole, Zone } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { findZoneIdForPoint } from '../common/geo.util';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';

/** Zona com o total de tarefas abertas nela, exibido no popup do mapa. */
export type ZoneWithOpenTasks = Zone & { openTaskCount: number };

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Zonas do tenant com a contagem de tarefas abertas em cada uma. A contagem
   * respeita a mesma visibilidade das tarefas: o admin vê todas, o funcionário só
   * as da própria equipe — senão o popup vazaria o volume de outras equipes.
   */
  async findAll(
    tenantUuid: string,
    siteId?: string,
    actorRole?: UserRole,
  ): Promise<ZoneWithOpenTasks[]> {
    const zones = await this.prisma.zone.findMany({
      where: { tenantUuid, ...(siteId ? { siteId } : {}) },
      orderBy: { createdAt: 'asc' },
    });
    if (zones.length === 0) return [];

    const grouped = await this.prisma.task.groupBy({
      by: ['zoneId'],
      where: {
        tenantUuid,
        zoneId: { in: zones.map((zone) => zone.id) },
        status: { in: [TaskStatus.pending, TaskStatus.in_progress] },
        ...(actorRole !== UserRole.ADMIN ? { assigneeRole: actorRole } : {}),
      },
      _count: { _all: true },
    });
    const counts = new Map(grouped.map((row) => [row.zoneId, row._count._all]));

    return zones.map((zone) => ({ ...zone, openTaskCount: counts.get(zone.id) ?? 0 }));
  }

  async findOne(id: string, tenantUuid: string): Promise<Zone> {
    const zone = await this.prisma.zone.findFirst({ where: { id, tenantUuid } });
    if (!zone) throw new NotFoundException(`Zone ${id} not found`);
    return zone;
  }

  async create(dto: CreateZoneDto, tenantUuid: string): Promise<Zone> {
    assertValidPolygon(dto.polygon);
    await this.assertSiteExists(dto.siteId, tenantUuid);

    const zone = await this.prisma.zone.create({
      data: {
        tenantUuid,
        siteId: dto.siteId,
        name: dto.name,
        category: dto.category ?? null,
        color: dto.color ?? null,
        polygon: dto.polygon as Prisma.InputJsonValue,
      },
    });
    // A zona nova pode capturar lixeiras do recinto: recalcula o belonging.
    await this.recomputeSiteZones(tenantUuid, zone.siteId);
    return zone;
  }

  async update(id: string, dto: UpdateZoneDto, tenantUuid: string): Promise<Zone> {
    const existing = await this.findOne(id, tenantUuid);
    if (dto.polygon !== undefined) assertValidPolygon(dto.polygon);

    const data: Prisma.ZoneUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category ?? null;
    if (dto.color !== undefined) data.color = dto.color ?? null;
    if (dto.polygon !== undefined) data.polygon = dto.polygon as Prisma.InputJsonValue;

    const zone = await this.prisma.zone.update({ where: { id }, data });
    // Mudar o polígono reatribui lixeiras: recalcula o belonging do recinto.
    if (dto.polygon !== undefined) {
      await this.recomputeSiteZones(tenantUuid, existing.siteId);
    }
    return zone;
  }

  async remove(id: string, tenantUuid: string): Promise<{ id: string }> {
    const existing = await this.findOne(id, tenantUuid);
    // FK SetNull zera o zoneId das lixeiras desta zona; recompute reatribui as que
    // caem em outra zona (sobreposição) e fixa o restante como "fora de zona".
    await this.prisma.zone.delete({ where: { id } });
    await this.recomputeSiteZones(tenantUuid, existing.siteId);
    return { id };
  }

  /**
   * Recalcula `zoneId` de todas as lixeiras e tarefas do Site após uma escrita de
   * zona. Reusa `findZoneIdForPoint` (geo.util) com as zonas ordenadas por criação
   * (desempate determinístico). Coordenada efetiva da lixeira: a própria (outdoor)
   * ou a da construção (indoor); a da tarefa segue a cadeia lixeira → construção →
   * câmera → própria. Só grava os registros cujo `zoneId` mudou.
   */
  private async recomputeSiteZones(tenantUuid: string, siteId: string): Promise<void> {
    const zones = await this.prisma.zone.findMany({
      where: { tenantUuid, siteId },
      select: { id: true, polygon: true },
      orderBy: { createdAt: 'asc' },
    });

    const bins = await this.prisma.trashBin.findMany({
      where: { tenantUuid, siteId },
      select: {
        id: true,
        zoneId: true,
        latitude: true,
        longitude: true,
        location: { select: { latitude: true, longitude: true } },
      },
    });

    const updates: Prisma.PrismaPromise<unknown>[] = [];
    // Zona nova de cada lixeira, usada logo abaixo pelas tarefas vinculadas a ela
    // (a tarefa herda o belonging já recalculado, não o que está no banco).
    const binZones = new Map<string, string | null>();
    for (const bin of bins) {
      const lat = bin.latitude ?? bin.location?.latitude ?? null;
      const lng = bin.longitude ?? bin.location?.longitude ?? null;
      const nextZoneId =
        lat != null && lng != null ? findZoneIdForPoint(lat, lng, zones) : null;
      binZones.set(bin.id, nextZoneId);
      if (nextZoneId !== bin.zoneId) {
        updates.push(
          this.prisma.trashBin.update({
            where: { id: bin.id },
            data: { zoneId: nextZoneId },
          }),
        );
      }
    }

    const tasks = await this.prisma.task.findMany({
      where: { tenantUuid, siteId },
      select: {
        id: true,
        zoneId: true,
        trashBinId: true,
        latitude: true,
        longitude: true,
        location: { select: { latitude: true, longitude: true } },
        camera: { select: { latitude: true, longitude: true } },
      },
    });

    for (const task of tasks) {
      let nextZoneId: string | null;
      if (task.trashBinId && binZones.has(task.trashBinId)) {
        nextZoneId = binZones.get(task.trashBinId) ?? null;
      } else {
        const lat = task.location?.latitude ?? task.camera?.latitude ?? task.latitude ?? null;
        const lng = task.location?.longitude ?? task.camera?.longitude ?? task.longitude ?? null;
        nextZoneId = lat != null && lng != null ? findZoneIdForPoint(lat, lng, zones) : null;
      }
      if (nextZoneId !== task.zoneId) {
        updates.push(
          this.prisma.task.update({
            where: { id: task.id },
            data: { zoneId: nextZoneId },
          }),
        );
      }
    }

    if (updates.length > 0) await this.prisma.$transaction(updates);
  }

  private async assertSiteExists(siteId: string, tenantUuid: string): Promise<void> {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantUuid },
      select: { id: true },
    });
    if (!site) throw new BadRequestException(`Site ${siteId} not found`);
  }
}

// Validação leve do GeoJSON da zona: precisa ser Polygon/MultiPolygon (ou um
// Feature que os embrulhe) com `coordinates`. O recorte fino fica no front/Turf.
function assertValidPolygon(polygon: unknown): void {
  if (typeof polygon !== 'object' || polygon === null) {
    throw new BadRequestException('polygon deve ser um objeto GeoJSON.');
  }
  const geometry = unwrapFeature(polygon as Record<string, unknown>);
  const type = geometry.type;
  if (type !== 'Polygon' && type !== 'MultiPolygon') {
    throw new BadRequestException('polygon deve ser um GeoJSON Polygon ou MultiPolygon.');
  }
  if (!Array.isArray(geometry.coordinates)) {
    throw new BadRequestException('polygon.coordinates inválido.');
  }
}

function unwrapFeature(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj.type === 'Feature' && obj.geometry && typeof obj.geometry === 'object') {
    return obj.geometry as Record<string, unknown>;
  }
  return obj;
}
