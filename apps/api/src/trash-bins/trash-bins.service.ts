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
import { FillForecast, forecastFill } from './forecast';

const FORECAST_LOOKBACK_DAYS = 7;
const FORECAST_MAX_SAMPLES = 50;

// Campos da localização expostos junto da lixeira. Exclui `floorPlans`
// (data URLs das plantas, potencialmente grandes): só interessam ao mapa da
// construção, então não devem trafegar em toda listagem de lixeiras.
const locationSelect = {
  id: true,
  tenantUuid: true,
  name: true,
  description: true,
  latitude: true,
  longitude: true,
  floorsCount: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LocationSelect;

const trashBinInclude = {
  location: { select: locationSelect },
} satisfies Prisma.TrashBinInclude;

type TrashBinWithLocation = Prisma.TrashBinGetPayload<{
  include: typeof trashBinInclude;
}>;

type TrashBinResponse = TrashBinWithLocation & {
  locationDescription: string | null;
  latitude: number;
  longitude: number;
  forecast: FillForecast | null;
};

@Injectable()
export class TrashBinsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantUuid: string): Promise<TrashBinResponse[]> {
    const bins = await this.prisma.trashBin.findMany({
      where: { tenantUuid },
      include: trashBinInclude,
      orderBy: { createdAt: 'desc' },
    });
    const forecasts = await this.computeForecasts(bins);
    return bins.map((bin) => this.toResponse(bin, forecasts.get(bin.id) ?? null));
  }

  async findOne(id: string, tenantUuid: string): Promise<TrashBinResponse> {
    const bin = await this.findOneRaw(id, tenantUuid);
    const forecasts = await this.computeForecasts([bin]);
    return this.toResponse(bin, forecasts.get(bin.id) ?? null);
  }

  private async computeForecasts(
    bins: TrashBinWithLocation[],
  ): Promise<Map<string, FillForecast | null>> {
    const result = new Map<string, FillForecast | null>();
    if (bins.length === 0) return result;
    const since = new Date(Date.now() - FORECAST_LOOKBACK_DAYS * 24 * 3600_000);

    const readings = await this.prisma.sensorReading.findMany({
      where: {
        trashBinId: { in: bins.map((b) => b.id) },
        receivedAt: { gte: since },
        fillLevel: { not: null },
      },
      select: { trashBinId: true, fillLevel: true, receivedAt: true },
      orderBy: { receivedAt: 'desc' },
      take: bins.length * FORECAST_MAX_SAMPLES,
    });

    const byBin = new Map<string, { receivedAt: Date; fillLevel: number }[]>();
    for (const r of readings) {
      if (r.fillLevel === null) continue;
      if (!byBin.has(r.trashBinId)) byBin.set(r.trashBinId, []);
      const list = byBin.get(r.trashBinId)!;
      if (list.length < FORECAST_MAX_SAMPLES) {
        list.push({ receivedAt: r.receivedAt, fillLevel: r.fillLevel });
      }
    }

    for (const bin of bins) {
      const points = byBin.get(bin.id) ?? [];
      result.set(bin.id, forecastFill(points, bin.fillLevel));
    }
    return result;
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
          mqttTopic: dto.mqttTopic?.trim() || null,
          distanceEmptyCm: dto.distanceEmptyCm ?? null,
          distanceFullCm: dto.distanceFullCm ?? null,
          floor: dto.floor ?? null,
          posX: dto.posX ?? null,
          posY: dto.posY ?? null,
          ...(await this.resolvePlacementForCreate(dto, tenantUuid)),
        },
        include: trashBinInclude,
      });
      return this.toResponse(bin, null);
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
      const forecasts = await this.computeForecasts([bin]);
      return this.toResponse(bin, forecasts.get(bin.id) ?? null);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A trash bin with code "${dto.code ?? existing.code}" already exists`);
      }
      throw err;
    }
  }

  async remove(id: string, tenantUuid: string): Promise<{ id: string }> {
    await this.findOneRaw(id, tenantUuid);
    // A lixeira carrega a própria coordenada (ou vincula a uma construção, que é
    // entidade de primeira classe): não há mais "posição órfã" para limpar.
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

  private toResponse(
    bin: TrashBinWithLocation,
    forecast: FillForecast | null,
  ): TrashBinResponse {
    return {
      ...bin,
      locationDescription: bin.location?.description ?? null,
      // Lixeira ao ar livre usa a própria coordenada; dentro de uma construção,
      // herda a coordenada da construção (que é o ponto dela no mapa).
      latitude: bin.latitude ?? bin.location?.latitude ?? 0,
      longitude: bin.longitude ?? bin.location?.longitude ?? 0,
      forecast,
    };
  }

  // Resolve o posicionamento da lixeira na criação: ou vinculada a uma
  // construção (`locationId`), ou "ao ar livre" com coordenada própria.
  private async resolvePlacementForCreate(
    dto: CreateTrashBinDto,
    tenantUuid: string,
  ): Promise<Pick<Prisma.TrashBinCreateInput, 'location' | 'latitude' | 'longitude'>> {
    if (dto.locationId) {
      await this.assertLocationExists(dto.locationId, tenantUuid);
      return { location: { connect: { id: dto.locationId } } };
    }

    if (dto.latitude == null || dto.longitude == null) {
      throw new BadRequestException(
        'Informe locationId ou latitude/longitude para cadastrar a lixeira.',
      );
    }

    return { latitude: dto.latitude, longitude: dto.longitude };
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
    if (dto.mqttTopic !== undefined) data.mqttTopic = dto.mqttTopic?.trim() || null;
    if (dto.distanceEmptyCm !== undefined) data.distanceEmptyCm = dto.distanceEmptyCm;
    if (dto.distanceFullCm !== undefined) data.distanceFullCm = dto.distanceFullCm;
    if (dto.floor !== undefined) data.floor = dto.floor ?? null;
    if (dto.posX !== undefined) data.posX = dto.posX ?? null;
    if (dto.posY !== undefined) data.posY = dto.posY ?? null;

    if (dto.locationId !== undefined) {
      if (dto.locationId) {
        // Vincular a uma construção: a coordenada própria deixa de valer.
        await this.assertLocationExists(dto.locationId, tenantUuid);
        data.location = { connect: { id: dto.locationId } };
        data.latitude = dto.latitude ?? null;
        data.longitude = dto.longitude ?? null;
      } else {
        // Soltar para "ao ar livre": precisa de coordenada própria.
        const latitude = dto.latitude ?? currentLocation?.latitude;
        const longitude = dto.longitude ?? currentLocation?.longitude;
        if (latitude == null || longitude == null) {
          throw new BadRequestException(
            'Informe latitude/longitude ao desvincular a lixeira de uma construção.',
          );
        }
        data.location = { disconnect: true };
        data.latitude = latitude;
        data.longitude = longitude;
      }
      return data;
    }

    // Sem mexer no vínculo: apenas atualizar a coordenada própria, se enviada.
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;

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
