import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCameraDto } from './dto/create-camera.dto';

/**
 * Remove qualquer menção a "Lixeira <código>" do nome da câmera. Usado para a
 * equipe de SEGURANCA, que não deve ver nada relacionado a lixeiras.
 * Ex.: "Lago - Lixeira PRQ-008" -> "Lago".
 */
function stripTrashBinFromName(name: string): string {
  const cleaned = name.replace(/\s*[-–—]\s*lixeira\b[^-–—]*/gi, '').trim();
  return cleaned || name;
}

const cameraInclude = {
  location: { select: { id: true, name: true } },
  trashBin: {
    select: {
      id: true,
      name: true,
      code: true,
      location: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.CameraInclude;

type CameraWithRelations = Prisma.CameraGetPayload<{
  include: {
    location: { select: { id: true; name: true } };
    trashBin: {
      select: {
        id: true;
        name: true;
        code: true;
        location: { select: { id: true; name: true } };
      };
    };
  };
}>;

// Alvo da câmera no formato consumido pelo front (mesma forma do SecurityCamera).
type CameraTarget =
  | { kind: 'location'; id: string; name: string }
  | { kind: 'trash_bin'; id: string; name: string; code: string };

interface CameraResponse {
  id: string;
  code: string;
  name: string;
  locationId: string;
  locationName: string;
  target: CameraTarget;
  status: CameraWithRelations['status'];
  model: string;
  ipAddress: string;
  resolution: string;
  fps: number;
  latitude: number;
  longitude: number;
  lastSeenAt: string | null;
  imageUrl: string;
  notes?: string;
}

@Injectable()
export class CamerasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantUuid: string, actorRole?: UserRole): Promise<CameraResponse[]> {
    const cameras = await this.prisma.camera.findMany({
      where: { tenantUuid },
      include: cameraInclude,
      orderBy: { code: 'asc' },
    });
    const hideTrashBinLink = actorRole === UserRole.SEGURANCA;
    return cameras.map((camera) => this.toResponse(camera, hideTrashBinLink));
  }

  async findOne(
    id: string,
    tenantUuid: string,
    actorRole?: UserRole,
  ): Promise<CameraResponse> {
    const camera = await this.prisma.camera.findFirst({
      where: { id, tenantUuid },
      include: cameraInclude,
    });
    if (!camera) throw new NotFoundException(`Camera ${id} not found`);
    return this.toResponse(camera, actorRole === UserRole.SEGURANCA);
  }

  async create(dto: CreateCameraDto, tenantUuid: string): Promise<CameraResponse> {
    try {
      const camera = await this.prisma.camera.create({
        data: {
          tenantUuid,
          code: dto.code.trim(),
          name: dto.name.trim(),
          latitude: dto.latitude,
          longitude: dto.longitude,
          // Cadastro simplificado: campos técnicos ganham um padrão quando omitidos.
          model: dto.model?.trim() || 'Não informado',
          ipAddress: dto.ipAddress?.trim() || 'Não informado',
          resolution: dto.resolution?.trim() || 'Não informado',
          fps: dto.fps ?? 30,
          status: dto.status,
          imageUrl: dto.imageUrl?.trim() || null,
          notes: dto.notes?.trim() || null,
          locationId: dto.locationId ?? null,
          trashBinId: dto.trashBinId ?? null,
        },
        include: cameraInclude,
      });
      return this.toResponse(camera);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A camera with code "${dto.code}" already exists`);
      }
      throw err;
    }
  }

  async remove(id: string, tenantUuid: string): Promise<{ id: string }> {
    const camera = await this.prisma.camera.findFirst({
      where: { id, tenantUuid },
      select: { id: true },
    });
    if (!camera) throw new NotFoundException(`Camera ${id} not found`);
    await this.prisma.camera.delete({ where: { id } });
    return { id };
  }

  private toResponse(
    camera: CameraWithRelations,
    hideTrashBinLink = false,
  ): CameraResponse {
    // Posição da câmera: a localização direta ou, para câmeras de lixeira, a
    // localização da própria lixeira.
    const location = camera.location ?? camera.trashBin?.location ?? null;

    // SEGURANCA não vê o vínculo de lixeira: o alvo vira sempre a posição e o
    // nome da câmera é higienizado para remover a referência à lixeira.
    const name = hideTrashBinLink ? stripTrashBinFromName(camera.name) : camera.name;

    const target: CameraTarget =
      camera.trashBin && !hideTrashBinLink
        ? {
            kind: 'trash_bin',
            id: camera.trashBin.id,
            name: camera.trashBin.name,
            code: camera.trashBin.code,
          }
        : {
            kind: 'location',
            id: location?.id ?? camera.id,
            name: location?.name ?? name,
          };

    return {
      id: camera.id,
      code: camera.code,
      name,
      locationId: location?.id ?? '',
      locationName: location?.name ?? '',
      target,
      status: camera.status,
      model: camera.model,
      ipAddress: camera.ipAddress,
      resolution: camera.resolution,
      fps: camera.fps,
      latitude: camera.latitude,
      longitude: camera.longitude,
      lastSeenAt: camera.lastSeenAt ? camera.lastSeenAt.toISOString() : null,
      imageUrl: camera.imageUrl ?? '',
      notes: camera.notes ?? undefined,
    };
  }
}
