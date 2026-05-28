import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrashBinDto } from './dto/create-trash-bin.dto';
import { UpdateTrashBinDto } from './dto/update-trash-bin.dto';

type TrashBinWithLocation = Prisma.TrashBinGetPayload<{
  include: { location: true };
}>;

type TrashBinResponse = TrashBinWithLocation & {
  locationDescription: string | null;
  latitude: number;
  longitude: number;
};

const trashBinInclude = {
  location: true,
} satisfies Prisma.TrashBinInclude;

@Injectable()
export class TrashBinsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantUuid: string): Promise<TrashBinResponse[]> {
    const bins = await this.prisma.trashBin.findMany({
      where: { tenantUuid },
      include: trashBinInclude,
      orderBy: { createdAt: 'desc' },
    });
    return bins.map((bin) => this.toResponse(bin));
  }

  async findOne(id: string, tenantUuid: string): Promise<TrashBinResponse> {
    return this.toResponse(await this.findOneRaw(id, tenantUuid));
  }

  async create(dto: CreateTrashBinDto, tenantUuid: string): Promise<TrashBinResponse> {
    try {
      const bin = await this.prisma.trashBin.create({
        data: {
          tenantUuid,
          name: dto.name,
          code: dto.code,
          capacityLiters: dto.capacityLiters,
          status: dto.status,
          fillLevel: dto.fillLevel,
          batteryLevel: dto.batteryLevel,
          location: await this.resolveLocationForCreate(dto, tenantUuid),
        },
        include: trashBinInclude,
      });
      return this.toResponse(bin);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A trash bin with code "${dto.code}" already exists`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateTrashBinDto, tenantUuid: string): Promise<TrashBinResponse> {
    const existing = await this.findOneRaw(id, tenantUuid);

    try {
      const bin = await this.prisma.trashBin.update({
        where: { id },
        data: await this.buildUpdateData(dto, tenantUuid, existing.location),
        include: trashBinInclude,
      });
      return this.toResponse(bin);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A trash bin with code "${dto.code ?? existing.code}" already exists`);
      }
      throw err;
    }
  }

  async remove(id: string, tenantUuid: string): Promise<{ id: string }> {
    await this.findOne(id, tenantUuid);
    await this.prisma.trashBin.delete({ where: { id } });
    return { id };
  }

  private async findOneRaw(id: string, tenantUuid: string): Promise<TrashBinWithLocation> {
    const bin = await this.prisma.trashBin.findFirst({
      where: { id, tenantUuid },
      include: trashBinInclude,
    });
    if (!bin) throw new NotFoundException(`TrashBin ${id} not found`);
    return bin;
  }

  private toResponse(bin: TrashBinWithLocation): TrashBinResponse {
    return {
      ...bin,
      locationDescription: bin.location.description,
      latitude: bin.location.latitude,
      longitude: bin.location.longitude,
    };
  }

  private async resolveLocationForCreate(
    dto: CreateTrashBinDto,
    tenantUuid: string,
  ): Promise<Prisma.LocationCreateNestedOneWithoutTrashBinsInput> {
    if (dto.locationId) {
      await this.assertLocationExists(dto.locationId, tenantUuid);
      return { connect: { id: dto.locationId } };
    }

    if (dto.latitude == null || dto.longitude == null) {
      throw new BadRequestException(
        'Informe locationId ou latitude/longitude para cadastrar a lixeira.',
      );
    }

    const locationName = dto.locationDescription?.trim() || dto.name;
    return {
      create: {
        tenantUuid,
        name: locationName,
        description: dto.locationDescription ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    };
  }

  private async buildUpdateData(
    dto: UpdateTrashBinDto,
    tenantUuid: string,
    currentLocation: TrashBinWithLocation['location'],
  ): Promise<Prisma.TrashBinUpdateInput> {
    const data: Prisma.TrashBinUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.capacityLiters !== undefined) data.capacityLiters = dto.capacityLiters;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.fillLevel !== undefined) data.fillLevel = dto.fillLevel;
    if (dto.batteryLevel !== undefined) data.batteryLevel = dto.batteryLevel;

    if (dto.locationId !== undefined) {
      if (!dto.locationId) {
        throw new BadRequestException('A lixeira precisa estar vinculada a uma localização.');
      }
      await this.assertLocationExists(dto.locationId, tenantUuid);
      data.location = { connect: { id: dto.locationId } };
      return data;
    }

    const hasLegacyLocationFields =
      dto.locationDescription !== undefined ||
      dto.latitude !== undefined ||
      dto.longitude !== undefined;

    if (hasLegacyLocationFields) {
      data.location = {
        update: {
          description: dto.locationDescription ?? currentLocation.description,
          latitude: dto.latitude ?? currentLocation.latitude,
          longitude: dto.longitude ?? currentLocation.longitude,
        },
      };
    }

    return data;
  }

  private async assertLocationExists(locationId: string, tenantUuid: string): Promise<void> {
    const exists = await this.prisma.location.findFirst({
      where: { id: locationId, tenantUuid },
      select: { id: true },
    });
    if (!exists) throw new BadRequestException(`Location ${locationId} not found`);
  }
}
