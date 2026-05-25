import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SensorReading, TrashBinStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';

const FILL_LEVEL_FULL_THRESHOLD = 90;

@Injectable()
export class SensorReadingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<SensorReading[]> {
    return this.prisma.sensorReading.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 200,
    });
  }

  async findByTrashBin(trashBinId: string): Promise<SensorReading[]> {
    const bin = await this.prisma.trashBin.findUnique({ where: { id: trashBinId } });
    if (!bin) throw new NotFoundException(`TrashBin ${trashBinId} not found`);

    return this.prisma.sensorReading.findMany({
      where: { trashBinId },
      orderBy: { receivedAt: 'desc' },
      take: 200,
    });
  }

  async create(dto: CreateSensorReadingDto): Promise<SensorReading> {
    const bin = await this.prisma.trashBin.findUnique({ where: { id: dto.trashBinId } });
    if (!bin) throw new NotFoundException(`TrashBin ${dto.trashBinId} not found`);

    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();
    const nextStatus = this.computeNextStatus(bin.status, dto.fillLevel);

    const [reading] = await this.prisma.$transaction([
      this.prisma.sensorReading.create({
        data: {
          trashBinId: dto.trashBinId,
          fillLevel: dto.fillLevel,
          batteryLevel: dto.batteryLevel ?? null,
          temperature: dto.temperature ?? null,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          payload: (dto.payload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          receivedAt,
        },
      }),
      this.prisma.trashBin.update({
        where: { id: dto.trashBinId },
        data: {
          fillLevel: dto.fillLevel,
          batteryLevel: dto.batteryLevel ?? bin.batteryLevel,
          lastSeenAt: receivedAt,
          status: nextStatus,
        },
      }),
    ]);

    return reading;
  }

  private computeNextStatus(currentStatus: TrashBinStatus, fillLevel: number): TrashBinStatus {
    if (
      currentStatus === TrashBinStatus.maintenance ||
      currentStatus === TrashBinStatus.inactive
    ) {
      return currentStatus;
    }
    if (fillLevel >= FILL_LEVEL_FULL_THRESHOLD) return TrashBinStatus.full;
    return TrashBinStatus.active;
  }
}
