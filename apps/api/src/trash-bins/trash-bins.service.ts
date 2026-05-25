import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, TrashBin } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrashBinDto } from './dto/create-trash-bin.dto';
import { UpdateTrashBinDto } from './dto/update-trash-bin.dto';

@Injectable()
export class TrashBinsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<TrashBin[]> {
    return this.prisma.trashBin.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string): Promise<TrashBin> {
    const bin = await this.prisma.trashBin.findUnique({ where: { id } });
    if (!bin) throw new NotFoundException(`TrashBin ${id} not found`);
    return bin;
  }

  async create(dto: CreateTrashBinDto): Promise<TrashBin> {
    try {
      return await this.prisma.trashBin.create({ data: dto });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A trash bin with code "${dto.code}" already exists`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateTrashBinDto): Promise<TrashBin> {
    await this.findOne(id);
    try {
      return await this.prisma.trashBin.update({ where: { id }, data: dto });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A trash bin with code "${dto.code}" already exists`);
      }
      throw err;
    }
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.findOne(id);
    await this.prisma.trashBin.delete({ where: { id } });
    return { id };
  }
}
