import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Location, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantUuid: string): Promise<Location[]> {
    return this.prisma.location.findMany({
      where: { tenantUuid },
      orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string, tenantUuid: string): Promise<Location> {
    const location = await this.prisma.location.findFirst({
      where: { id, tenantUuid },
    });
    if (!location) throw new NotFoundException(`Location ${id} not found`);
    return location;
  }

  async create(dto: CreateLocationDto, tenantUuid: string): Promise<Location> {
    return this.prisma.location.create({
      data: {
        tenantUuid,
        name: dto.name,
        description: dto.description ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });
  }

  async update(id: string, dto: UpdateLocationDto, tenantUuid: string): Promise<Location> {
    await this.findOne(id, tenantUuid);

    const data: Prisma.LocationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;

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
