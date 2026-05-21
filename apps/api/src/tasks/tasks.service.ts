import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const taskInclude = {
  trashBin: {
    select: { id: true, name: true, code: true },
  },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.task.findMany({
      include: taskInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async get(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException(`Tarefa ${id} não encontrada`);
    return task;
  }

  async create(data: CreateTaskDto) {
    const trashBinId = this.normalizeBinId(data.trashBinId);
    if (trashBinId) await this.assertBinExists(trashBinId);

    return this.prisma.task.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        priority: data.priority,
        trashBinId: trashBinId ?? null,
        assigneeName: data.assigneeName ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
      include: taskInclude,
    });
  }

  async update(id: string, data: UpdateTaskDto) {
    await this.get(id);

    const trashBinId =
      data.trashBinId === undefined
        ? undefined
        : this.normalizeBinId(data.trashBinId);

    if (trashBinId) await this.assertBinExists(trashBinId);

    return this.prisma.task.update({
      where: { id },
      data: {
        title: data.title,
        description:
          data.description === undefined ? undefined : data.description,
        status: data.status,
        priority: data.priority,
        trashBinId:
          data.trashBinId === undefined ? undefined : trashBinId ?? null,
        assigneeName:
          data.assigneeName === undefined ? undefined : data.assigneeName,
        dueDate:
          data.dueDate === undefined
            ? undefined
            : data.dueDate
              ? new Date(data.dueDate)
              : null,
      },
      include: taskInclude,
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.task.delete({ where: { id } });
    return { id };
  }

  private normalizeBinId(value: string | null | undefined): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async assertBinExists(id: string): Promise<void> {
    const bin = await this.prisma.trashBin.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!bin) {
      throw new BadRequestException(`Lixeira ${id} não encontrada`);
    }
  }
}
