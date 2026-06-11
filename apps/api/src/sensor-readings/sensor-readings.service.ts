import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SensorReading, TrashBinStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';
import { AutomationService } from '../automation/automation.service';
import { FILL_LEVEL_FULL_THRESHOLD } from '../automation/rules';

type TrashBinForReading = Prisma.TrashBinGetPayload<{}>;

interface PersistReadingInput {
  fillLevel?: number | null;
  distanceCm?: number | null;
  batteryLevel?: number | null;
  temperature?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  sensorError?: string | null;
  mqttTopic?: string | null;
  deviceMillis?: number | null;
  payload?: Record<string, unknown>;
  receivedAt?: string | Date | null;
}

interface MqttReadingOptions {
  trashBinCode?: string;
  trashBinId?: string;
}

@Injectable()
export class SensorReadingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automation: AutomationService,
  ) {}

  async findAll(tenantUuid: string): Promise<SensorReading[]> {
    return this.prisma.sensorReading.findMany({
      where: { tenantUuid },
      orderBy: { receivedAt: 'desc' },
      take: 200,
    });
  }

  async findByTrashBin(trashBinId: string, tenantUuid: string): Promise<SensorReading[]> {
    const bin = await this.prisma.trashBin.findFirst({
      where: { id: trashBinId, tenantUuid },
      select: { id: true },
    });
    if (!bin) throw new NotFoundException(`TrashBin ${trashBinId} not found`);

    return this.prisma.sensorReading.findMany({
      where: { trashBinId, tenantUuid },
      orderBy: { receivedAt: 'desc' },
      take: 200,
    });
  }

  async create(dto: CreateSensorReadingDto, tenantUuid: string): Promise<SensorReading> {
    const bin = await this.prisma.trashBin.findFirst({
      where: { id: dto.trashBinId, tenantUuid },
    });
    if (!bin) throw new NotFoundException(`TrashBin ${dto.trashBinId} not found`);

    return this.persistReading(bin, tenantUuid, dto);
  }

  async createFromMqttMessage(
    topic: string,
    message: Record<string, unknown>,
    tenantUuid: string,
    options: MqttReadingOptions = {},
  ): Promise<SensorReading> {
    const bin = await this.resolveMqttTrashBin(topic, tenantUuid, options);

    return this.persistReading(bin, tenantUuid, {
      fillLevel: numberFrom(message.fillLevel ?? message.fill_level ?? message.nivel_percentual),
      distanceCm: numberFrom(message.distanceCm ?? message.distance_cm ?? message.distancia_cm),
      batteryLevel: numberFrom(message.batteryLevel ?? message.battery_level),
      temperature: numberFrom(message.temperature ?? message.temperatura),
      latitude: numberFrom(message.latitude),
      longitude: numberFrom(message.longitude),
      sensorError: stringFrom(message.sensorError ?? message.sensor_error ?? message.erro),
      mqttTopic: topic,
      deviceMillis: numberFrom(message.deviceMillis ?? message.device_millis ?? message.millis),
      payload: message,
    });
  }

  private async persistReading(
    bin: TrashBinForReading,
    tenantUuid: string,
    input: PersistReadingInput,
  ): Promise<SensorReading> {
    const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
    if (Number.isNaN(receivedAt.getTime())) {
      throw new BadRequestException('receivedAt invalido');
    }

    const distanceCm = input.distanceCm ?? null;
    const fillLevel =
      input.fillLevel ?? this.computeFillLevelFromDistance(bin, distanceCm);
    const sensorError = input.sensorError?.trim() || null;

    if (fillLevel === null && distanceCm === null && sensorError === null) {
      throw new BadRequestException(
        'Informe fillLevel, distanceCm ou sensorError para registrar a leitura.',
      );
    }

    const nextStatus = this.computeNextStatus(bin.status, fillLevel);
    const updateData: Prisma.TrashBinUpdateInput = {
      lastSeenAt: receivedAt,
      status: nextStatus,
    };

    if (fillLevel !== null) updateData.fillLevel = fillLevel;
    if (input.batteryLevel !== undefined) {
      updateData.batteryLevel = input.batteryLevel;
    }

    const [reading] = await this.prisma.$transaction([
      this.prisma.sensorReading.create({
        data: {
          tenantUuid,
          trashBinId: bin.id,
          fillLevel,
          distanceCm,
          batteryLevel: input.batteryLevel ?? null,
          temperature: input.temperature ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          sensorError,
          mqttTopic: input.mqttTopic ?? null,
          deviceMillis: input.deviceMillis ?? null,
          payload: (input.payload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          receivedAt,
        },
      }),
      this.prisma.trashBin.update({
        where: { id: bin.id },
        data: updateData,
      }),
    ]);

    await this.automation.evaluateBin(bin.id, tenantUuid);

    return reading;
  }

  private async resolveMqttTrashBin(
    topic: string,
    tenantUuid: string,
    options: MqttReadingOptions,
  ): Promise<TrashBinForReading> {
    if (options.trashBinId) {
      const bin = await this.prisma.trashBin.findFirst({
        where: { id: options.trashBinId, tenantUuid },
      });
      if (bin) return bin;
      throw new NotFoundException(`TrashBin ${options.trashBinId} not found`);
    }

    if (options.trashBinCode) {
      const bin = await this.prisma.trashBin.findFirst({
        where: { code: options.trashBinCode, tenantUuid },
      });
      if (bin) return bin;
      throw new NotFoundException(`TrashBin with code ${options.trashBinCode} not found`);
    }

    const bin = await this.prisma.trashBin.findFirst({
      where: { tenantUuid, mqttTopic: topic },
      orderBy: { createdAt: 'asc' },
    });
    if (bin) return bin;

    throw new NotFoundException(`No trash bin configured for MQTT topic ${topic}`);
  }

  private computeFillLevelFromDistance(
    bin: TrashBinForReading,
    distanceCm: number | null,
  ): number | null {
    if (distanceCm === null) return null;
    if (bin.distanceEmptyCm === null || bin.distanceFullCm === null) return null;
    if (bin.distanceEmptyCm <= bin.distanceFullCm) return null;

    const ratio =
      ((bin.distanceEmptyCm - distanceCm) /
        (bin.distanceEmptyCm - bin.distanceFullCm)) *
      100;
    return clampInt(Math.round(ratio), 0, 100);
  }

  private computeNextStatus(
    currentStatus: TrashBinStatus,
    fillLevel: number | null,
  ): TrashBinStatus {
    if (
      currentStatus === TrashBinStatus.maintenance ||
      currentStatus === TrashBinStatus.inactive
    ) {
      return currentStatus;
    }
    if (fillLevel === null) {
      return currentStatus === TrashBinStatus.offline
        ? TrashBinStatus.active
        : currentStatus;
    }
    if (fillLevel >= FILL_LEVEL_FULL_THRESHOLD) return TrashBinStatus.full;
    return TrashBinStatus.active;
  }
}

function clampInt(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function numberFrom(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringFrom(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
