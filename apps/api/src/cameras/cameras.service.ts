import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

  async findAll(tenantUuid: string): Promise<CameraResponse[]> {
    const cameras = await this.prisma.camera.findMany({
      where: { tenantUuid },
      include: cameraInclude,
      orderBy: { code: 'asc' },
    });
    return cameras.map((camera) => this.toResponse(camera));
  }

  async findOne(id: string, tenantUuid: string): Promise<CameraResponse> {
    const camera = await this.prisma.camera.findFirst({
      where: { id, tenantUuid },
      include: cameraInclude,
    });
    if (!camera) throw new NotFoundException(`Camera ${id} not found`);
    return this.toResponse(camera);
  }

  private toResponse(camera: CameraWithRelations): CameraResponse {
    // Posição da câmera: a localização direta ou, para câmeras de lixeira, a
    // localização da própria lixeira.
    const location = camera.location ?? camera.trashBin?.location ?? null;

    const target: CameraTarget = camera.trashBin
      ? {
          kind: 'trash_bin',
          id: camera.trashBin.id,
          name: camera.trashBin.name,
          code: camera.trashBin.code,
        }
      : {
          kind: 'location',
          id: location?.id ?? camera.id,
          name: location?.name ?? camera.name,
        };

    return {
      id: camera.id,
      code: camera.code,
      name: camera.name,
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
