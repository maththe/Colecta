import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, TaskKind, TaskStatus, TrashBin, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import {
  composeDescription,
  composePriority,
  composeTitle,
  computeDueDate,
  Issue,
  issuesEqual,
} from '../automation/rules';

type TaskWithBin = Prisma.TaskGetPayload<{
  include: {
    trashBin: { select: { id: true; name: true; code: true } };
    location: { select: { id: true; name: true; latitude: true; longitude: true } };
  };
}>;

const taskInclude = {
  trashBin: { select: { id: true, name: true, code: true } },
  location: { select: { id: true, name: true, latitude: true, longitude: true } },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantUuid: string): Promise<TaskWithBin[]> {
    return this.prisma.task.findMany({
      where: { tenantUuid },
      include: taskInclude,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string, tenantUuid: string): Promise<TaskWithBin> {
    const task = await this.prisma.task.findFirst({
      where: { id, tenantUuid },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async create(dto: CreateTaskDto, tenantUuid: string): Promise<TaskWithBin> {
    if (dto.trashBinId) await this.assertTrashBinExists(dto.trashBinId, tenantUuid);
    if (dto.locationId) await this.assertLocationExists(dto.locationId, tenantUuid);

    const data: Prisma.TaskCreateInput = {
      tenantUuid,
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status,
      priority: dto.priority,
      assigneeName: dto.assigneeName ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      trashBin: dto.trashBinId ? { connect: { id: dto.trashBinId } } : undefined,
      location: dto.locationId ? { connect: { id: dto.locationId } } : undefined,
    };

    return this.prisma.task.create({ data, include: taskInclude });
  }

  async update(
    id: string,
    dto: UpdateTaskDto,
    tenantUuid: string,
    actorRole?: UserRole,
  ): Promise<TaskWithBin> {
    const current = await this.findOne(id, tenantUuid);
    this.assertCanUpdate(actorRole, current.status, dto);

    if (dto.trashBinId) await this.assertTrashBinExists(dto.trashBinId, tenantUuid);
    if (dto.locationId) await this.assertLocationExists(dto.locationId, tenantUuid);

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
    if (dto.locationId !== undefined) {
      data.location = dto.locationId ? { connect: { id: dto.locationId } } : { disconnect: true };
    }

    return this.prisma.task.update({ where: { id }, data, include: taskInclude });
  }

  async remove(id: string, tenantUuid: string): Promise<{ id: string }> {
    await this.findOne(id, tenantUuid);
    await this.prisma.task.delete({ where: { id } });
    return { id };
  }

  async findOpenAutoTaskByBin(
    trashBinId: string,
    tenantUuid: string,
  ): Promise<TaskWithBin | null> {
    return this.prisma.task.findFirst({
      where: {
        tenantUuid,
        trashBinId,
        kind: TaskKind.auto,
        status: { in: [TaskStatus.pending, TaskStatus.in_progress] },
      },
      include: taskInclude,
    });
  }

  async upsertAutoTask(params: {
    tenantUuid: string;
    bin: Pick<TrashBin, 'id' | 'code'>;
    issues: Issue[];
  }): Promise<TaskWithBin | null> {
    const { tenantUuid, bin, issues } = params;
    const open = await this.findOpenAutoTaskByBin(bin.id, tenantUuid);

    if (!open) {
      if (issues.length === 0) return null;
      const now = new Date();
      return this.prisma.task.create({
        data: {
          tenantUuid,
          title: composeTitle(bin.code, issues),
          description: composeDescription(bin.code, issues),
          status: TaskStatus.pending,
          priority: composePriority(issues),
          kind: TaskKind.auto,
          issues,
          trashBin: { connect: { id: bin.id } },
          dueDate: computeDueDate(issues, now),
        },
        include: taskInclude,
      });
    }

    if (issuesEqual(open.issues, issues)) return open;

    return this.prisma.task.update({
      where: { id: open.id },
      data: {
        title: composeTitle(bin.code, issues),
        description: composeDescription(bin.code, issues),
        priority: composePriority(issues),
        issues,
      },
      include: taskInclude,
    });
  }

  private async assertTrashBinExists(trashBinId: string, tenantUuid: string): Promise<void> {
    const exists = await this.prisma.trashBin.findFirst({
      where: { id: trashBinId, tenantUuid },
      select: { id: true },
    });
    if (!exists) throw new BadRequestException(`TrashBin ${trashBinId} not found`);
  }

  private async assertLocationExists(locationId: string, tenantUuid: string): Promise<void> {
    const exists = await this.prisma.location.findFirst({
      where: { id: locationId, tenantUuid },
      select: { id: true },
    });
    if (!exists) throw new BadRequestException(`Location ${locationId} not found`);
  }

  private assertCanUpdate(
    actorRole: UserRole | undefined,
    currentStatus: TaskStatus,
    dto: UpdateTaskDto,
  ): void {
    if (actorRole === UserRole.ADMIN) return;

    if (actorRole !== UserRole.FUNCIONARIO) {
      throw new ForbiddenException('Você não tem permissão para atualizar tarefas.');
    }

    const changedFields = Object.entries(dto).filter(([, value]) => value !== undefined);
    if (changedFields.length !== 1 || dto.status === undefined) {
      throw new ForbiddenException('Funcionários só podem alterar o status da tarefa.');
    }

    if (dto.status === currentStatus) return;

    const canStart =
      currentStatus === TaskStatus.pending && dto.status === TaskStatus.in_progress;
    const canFinish = currentStatus === TaskStatus.in_progress && dto.status === TaskStatus.done;

    if (!canStart && !canFinish) {
      throw new BadRequestException('Transição de status não permitida para funcionário.');
    }
  }
}
