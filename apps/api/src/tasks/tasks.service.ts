import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, Task } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

type TaskWithBin = Prisma.TaskGetPayload<{
  include: { trashBin: { select: { id: true; name: true; code: true } } };
}>;

const taskInclude = {
  trashBin: { select: { id: true, name: true, code: true } },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<TaskWithBin[]> {
    return this.prisma.task.findMany({
      include: taskInclude,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string): Promise<TaskWithBin> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async create(dto: CreateTaskDto): Promise<TaskWithBin> {
    if (dto.trashBinId) await this.assertTrashBinExists(dto.trashBinId);

    const data: Prisma.TaskCreateInput = {
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status,
      priority: dto.priority,
      assigneeName: dto.assigneeName ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      trashBin: dto.trashBinId ? { connect: { id: dto.trashBinId } } : undefined,
    };

    return this.prisma.task.create({ data, include: taskInclude });
  }

  async update(id: string, dto: UpdateTaskDto): Promise<TaskWithBin> {
    await this.findOne(id);
    if (dto.trashBinId) await this.assertTrashBinExists(dto.trashBinId);

    const data: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.assigneeName !== undefined) data.assigneeName = dto.assigneeName ?? null;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.trashBinId !== undefined) {
      data.trashBin = dto.trashBinId ? { connect: { id: dto.trashBinId } } : { disconnect: true };
    }

    return this.prisma.task.update({ where: { id }, data, include: taskInclude });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.findOne(id);
    await this.prisma.task.delete({ where: { id } });
    return { id };
  }

  private async assertTrashBinExists(trashBinId: string): Promise<void> {
    const exists = await this.prisma.trashBin.findUnique({
      where: { id: trashBinId },
      select: { id: true },
    });
    if (!exists) throw new BadRequestException(`TrashBin ${trashBinId} not found`);
  }
}
