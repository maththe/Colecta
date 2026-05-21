import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TrashBinStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';

@Injectable()
export class SensorReadingsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.sensorReading.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 200,
    });
  }

  async listByBin(trashBinId: string) {
    const bin = await this.prisma.trashBin.findUnique({
      where: { id: trashBinId },
      select: { id: true },
    });
    if (!bin) {
      throw new NotFoundException(`Lixeira ${trashBinId} não encontrada`);
    }
    return this.prisma.sensorReading.findMany({
      where: { trashBinId },
      orderBy: { receivedAt: 'desc' },
      take: 200,
    });
  }

  async create(data: CreateSensorReadingDto) {
    const bin = await this.prisma.trashBin.findUnique({
      where: { id: data.trashBinId },
    });
    if (!bin) {
      throw new NotFoundException(`Lixeira ${data.trashBinId} não encontrada`);
    }

    const receivedAt = data.receivedAt ? new Date(data.receivedAt) : new Date();

    const nextStatus = this.computeStatus(bin.status, data.fillLevel);

    const [reading] = await this.prisma.$transaction([
      this.prisma.sensorReading.create({
        data: {
          trashBinId: data.trashBinId,
          fillLevel: data.fillLevel,
          batteryLevel: data.batteryLevel ?? null,
          temperature: data.temperature ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          payload:
            data.payload === undefined
              ? Prisma.JsonNull
              : (data.payload as Prisma.InputJsonValue),
          receivedAt,
        },
      }),
      this.prisma.trashBin.update({
        where: { id: data.trashBinId },
        data: {
          fillLevel: data.fillLevel,
          batteryLevel:
            data.batteryLevel === undefined
              ? undefined
              : data.batteryLevel,
          lastSeenAt: receivedAt,
          status: nextStatus,
        },
      }),
    ]);

    return reading;
  }

  private computeStatus(
    current: TrashBinStatus,
    fillLevel: number,
  ): TrashBinStatus {
    // Don't override administrative states.
    if (current === TrashBinStatus.maintenance || current === TrashBinStatus.inactive) {
      return current;
    }
    if (fillLevel >= 90) return TrashBinStatus.full;
    return TrashBinStatus.active;
  }
}
