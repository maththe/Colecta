import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrashBinDto } from './dto/create-trash-bin.dto';
import { UpdateTrashBinDto } from './dto/update-trash-bin.dto';

@Injectable()
export class TrashBinsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.trashBin.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const bin = await this.prisma.trashBin.findUnique({ where: { id } });
    if (!bin) throw new NotFoundException(`Lixeira ${id} não encontrada`);
    return bin;
  }

  async create(data: CreateTrashBinDto) {
    try {
      return await this.prisma.trashBin.create({
        data: {
          name: data.name,
          code: data.code,
          locationDescription: data.locationDescription ?? null,
          latitude: data.latitude,
          longitude: data.longitude,
          capacityLiters: data.capacityLiters,
          status: data.status,
          fillLevel: data.fillLevel ?? null,
          batteryLevel: data.batteryLevel ?? null,
        },
      });
    } catch (err) {
      this.handleUniqueError(err, data.code);
      throw err;
    }
  }

  async update(id: string, data: UpdateTrashBinDto) {
    await this.get(id);
    try {
      return await this.prisma.trashBin.update({
        where: { id },
        data: {
          name: data.name,
          code: data.code,
          locationDescription:
            data.locationDescription === undefined
              ? undefined
              : data.locationDescription,
          latitude: data.latitude,
          longitude: data.longitude,
          capacityLiters: data.capacityLiters,
          status: data.status,
          fillLevel: data.fillLevel,
          batteryLevel: data.batteryLevel,
        },
      });
    } catch (err) {
      this.handleUniqueError(err, data.code);
      throw err;
    }
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.trashBin.delete({ where: { id } });
    return { id };
  }

  private handleUniqueError(err: unknown, code?: string): void {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new ConflictException(
        `Código de lixeira${code ? ` "${code}"` : ''} já está em uso`,
      );
    }
  }
}
