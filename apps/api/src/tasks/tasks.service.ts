import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  NotificationKind,
  Prisma,
  TaskKind,
  TaskPriority,
  TaskStatus,
  TrashBin,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { CreateSecurityOccurrenceDto } from './dto/create-security-occurrence.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import {
  composeDescription,
  composePriority,
  composeTitle,
  computeDueDate,
  Issue,
  issuesEqual,
} from '../automation/rules';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../mailer/mailer.service';
import { isEmployeeRole, isTaskAssigneeRole } from '../auth/role-groups';
import { resolveTaskSiteId } from '../common/geo.util';

type TaskWithBin = Prisma.TaskGetPayload<{
  include: {
    trashBin: { select: { id: true; name: true; code: true } };
    location: { select: { id: true; name: true; latitude: true; longitude: true } };
    startedBy: { select: { id: true; name: true } };
  };
}>;

const taskInclude = {
  trashBin: { select: { id: true, name: true, code: true } },
  location: { select: { id: true, name: true, latitude: true, longitude: true } },
  startedBy: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mailer: MailerService,
  ) {}

  async findAll(tenantUuid: string, actorRole?: UserRole): Promise<TaskWithBin[]> {
    // Visibilidade por equipe no servidor: o admin vê todas; o funcionário só as
    // do próprio papel. Não confiamos no filtro de cliente (board) para isso.
    const where: Prisma.TaskWhereInput = { tenantUuid };
    if (actorRole !== UserRole.ADMIN) {
      where.assigneeRole = actorRole;
    }
    return this.prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Tarefas posicionadas livremente no mapa (com lat/lng próprias) que ainda
   * estão abertas — concluídas/canceladas somem do mapa. A visibilidade é
   * resolvida no servidor: o admin vê todas; o funcionário só vê as da sua
   * equipe (assigneeRole). Não confiamos em filtro de cliente para isso.
   */
  async findMapTasks(tenantUuid: string, actorRole?: UserRole): Promise<TaskWithBin[]> {
    const where: Prisma.TaskWhereInput = {
      tenantUuid,
      latitude: { not: null },
      longitude: { not: null },
      status: { in: [TaskStatus.pending, TaskStatus.in_progress] },
    };
    if (actorRole !== UserRole.ADMIN) {
      where.assigneeRole = actorRole;
    }
    return this.prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
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
    if (dto.cameraId) await this.assertCameraExists(dto.cameraId, tenantUuid);
    this.assertAssigneeRole(dto.assigneeRole);
    this.assertTrashBinAssigneeRole(dto.trashBinId, dto.assigneeRole);

    const siteId = await resolveTaskSiteId(this.prisma, {
      tenantUuid,
      trashBinId: dto.trashBinId ?? null,
      locationId: dto.locationId ?? null,
      cameraId: dto.cameraId ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    });

    const data: Prisma.TaskCreateInput = {
      tenantUuid,
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status,
      priority: dto.priority,
      assigneeRole: dto.assigneeRole,
      assigneeName: dto.assigneeName ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      floor: dto.floor ?? null,
      posX: dto.posX ?? null,
      posY: dto.posY ?? null,
      site: { connect: { id: siteId } },
      trashBin: dto.trashBinId ? { connect: { id: dto.trashBinId } } : undefined,
      location: dto.locationId ? { connect: { id: dto.locationId } } : undefined,
      camera: dto.cameraId ? { connect: { id: dto.cameraId } } : undefined,
    };

    const created = await this.prisma.task.create({ data, include: taskInclude });
    await this.notifyUrgentAssignee(created);
    return created;
  }

  async createSecurityOccurrence(
    dto: CreateSecurityOccurrenceDto,
    tenantUuid: string,
  ): Promise<TaskWithBin> {
    if (dto.trashBinId) await this.assertTrashBinExists(dto.trashBinId, tenantUuid);
    if (dto.locationId) await this.assertLocationExists(dto.locationId, tenantUuid);
    if (dto.cameraId) await this.assertCameraExists(dto.cameraId, tenantUuid);

    const siteId = await resolveTaskSiteId(this.prisma, {
      tenantUuid,
      trashBinId: dto.trashBinId ?? null,
      locationId: dto.locationId ?? null,
      cameraId: dto.cameraId ?? null,
    });

    const created = await this.prisma.task.create({
      data: {
        tenantUuid,
        title: dto.title,
        description: this.composeSecurityOccurrenceDescription(dto),
        status: TaskStatus.pending,
        priority: dto.priority ?? TaskPriority.high,
        kind: TaskKind.manual,
        assigneeRole: UserRole.SEGURANCA,
        assigneeName: null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        site: { connect: { id: siteId } },
        trashBin: dto.trashBinId ? { connect: { id: dto.trashBinId } } : undefined,
        location: dto.locationId ? { connect: { id: dto.locationId } } : undefined,
        camera: dto.cameraId ? { connect: { id: dto.cameraId } } : undefined,
      },
      include: taskInclude,
    });

    await this.notifySecurityOfOccurrence(created);
    return created;
  }

  async update(
    id: string,
    dto: UpdateTaskDto,
    tenantUuid: string,
    actorRole?: UserRole,
    actorId?: string,
  ): Promise<TaskWithBin> {
    const current = await this.findOne(id, tenantUuid);
    this.assertCanUpdate(actorRole, current.status, dto);

    if (dto.trashBinId) await this.assertTrashBinExists(dto.trashBinId, tenantUuid);
    if (dto.locationId) await this.assertLocationExists(dto.locationId, tenantUuid);

    // Mantém a regra de que tarefas vinculadas a uma lixeira pertencem ao time
    // de limpeza, considerando o estado resultante após a edição.
    if (dto.trashBinId !== undefined || dto.assigneeRole !== undefined) {
      const effectiveTrashBinId =
        dto.trashBinId !== undefined ? dto.trashBinId : current.trashBinId;
      const effectiveRole =
        dto.assigneeRole !== undefined ? dto.assigneeRole : current.assigneeRole;
      this.assertTrashBinAssigneeRole(effectiveTrashBinId, effectiveRole);
    }

    const data: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.assigneeRole !== undefined) {
      this.assertAssigneeRole(dto.assigneeRole);
      data.assigneeRole = dto.assigneeRole;
    }
    if (dto.assigneeName !== undefined) data.assigneeName = dto.assigneeName ?? null;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.trashBinId !== undefined) {
      data.trashBin = dto.trashBinId ? { connect: { id: dto.trashBinId } } : { disconnect: true };
    }
    if (dto.locationId !== undefined) {
      data.location = dto.locationId ? { connect: { id: dto.locationId } } : { disconnect: true };
    }
    if (dto.floor !== undefined) data.floor = dto.floor ?? null;
    if (dto.posX !== undefined) data.posX = dto.posX ?? null;
    if (dto.posY !== undefined) data.posY = dto.posY ?? null;

    const isStarting =
      dto.status === TaskStatus.in_progress && current.status === TaskStatus.pending;
    if (isStarting) {
      data.startedAt = new Date();
      data.startedBy = actorId ? { connect: { id: actorId } } : { disconnect: true };

      // Tarefa sem responsável específico (atribuída só a um time): ao iniciar,
      // ela passa a ser atrelada à pessoa que a iniciou. Respeita um nome de
      // responsável enviado explicitamente nesta mesma atualização.
      //
      // Tarefas de segurança são uma exceção: ficam num pool compartilhado da
      // equipe e devem permanecer sem responsável mesmo após iniciadas.
      const effectiveAssigneeName =
        dto.assigneeName !== undefined ? dto.assigneeName : current.assigneeName;
      const hasAssignee = !!effectiveAssigneeName && effectiveAssigneeName.trim() !== '';
      const isSecurityTask = current.assigneeRole === UserRole.SEGURANCA;
      if (actorId && !hasAssignee && !isSecurityTask) {
        const starter = await this.prisma.user.findUnique({
          where: { id: actorId },
          select: { name: true },
        });
        if (starter?.name) data.assigneeName = starter.name;
      }
    }

    const isCompleting =
      dto.status === TaskStatus.done && current.status !== TaskStatus.done;
    if (isCompleting) {
      data.completedAt = new Date();
    }
    const isReopening =
      dto.status !== undefined &&
      dto.status !== TaskStatus.done &&
      current.status === TaskStatus.done;
    if (isReopening) {
      data.completedAt = null;
    }

    // Recomputa o Site quando o vínculo (lixeira/construção) muda.
    if (dto.trashBinId !== undefined || dto.locationId !== undefined) {
      const siteId = await resolveTaskSiteId(this.prisma, {
        tenantUuid,
        trashBinId: dto.trashBinId !== undefined ? dto.trashBinId : current.trashBinId,
        locationId: dto.locationId !== undefined ? dto.locationId : current.locationId,
        cameraId: current.cameraId,
        latitude: current.latitude,
        longitude: current.longitude,
      });
      data.site = { connect: { id: siteId } };
    }

    return this.prisma.task.update({
      where: { id },
      data,
      include: taskInclude,
    });
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
      const priority = composePriority(issues);
      // Auto-tarefa sempre tem bin → herda o Site da lixeira.
      const siteId = await resolveTaskSiteId(this.prisma, {
        tenantUuid,
        trashBinId: bin.id,
      });
      const created = await this.prisma.task.create({
        data: {
          tenantUuid,
          title: composeTitle(bin.code, issues),
          description: composeDescription(bin.code, issues),
          status: TaskStatus.pending,
          priority,
          kind: TaskKind.auto,
          issues,
          assigneeRole: UserRole.LIMPEZA,
          site: { connect: { id: siteId } },
          trashBin: { connect: { id: bin.id } },
          dueDate: computeDueDate(issues, now),
        },
        include: taskInclude,
      });
      await this.notifyAdminsOfAutoTask(created);
      await this.notifyUrgentAssignee(created);
      return created;
    }

    if (issuesEqual(open.issues, issues)) return open;

    return this.prisma.task.update({
      where: { id: open.id },
      data: {
        title: composeTitle(bin.code, issues),
        description: composeDescription(bin.code, issues),
        priority: composePriority(issues),
        issues,
        assigneeRole: UserRole.LIMPEZA,
      },
      include: taskInclude,
    });
  }

  /** Notifica o funcionário responsável quando uma tarefa urgente é criada. */
  private async notifyUrgentAssignee(task: TaskWithBin): Promise<void> {
    if (task.priority !== TaskPriority.urgent) return;
    if (!task.assigneeName) {
      if (!task.assigneeRole) return;
      await this.notifications.emitToRole(task.assigneeRole, {
        tenantUuid: task.tenantUuid,
        kind: NotificationKind.task_urgent,
        title: `Tarefa urgente: ${task.title}`,
        body: task.description ?? null,
        taskId: task.id,
      });
      return;
    }
    const targets = await this.notifications.findUsersByAssigneeName(
      task.assigneeName,
      task.tenantUuid,
    );
    if (targets.length === 0) return;
    await this.notifications.emitToUsers(targets, {
      tenantUuid: task.tenantUuid,
      kind: NotificationKind.task_urgent,
      title: `Tarefa urgente: ${task.title}`,
      body: task.description ?? null,
      taskId: task.id,
    });
    await this.mailer.sendTaskUrgent({
      tenantUuid: task.tenantUuid,
      taskId: task.id,
      taskTitle: task.title,
      dueDate: task.dueDate,
      assigneeName: task.assigneeName,
    });
  }

  /** Notifica os admins quando a automação cria uma tarefa para uma lixeira. */
  private async notifyAdminsOfAutoTask(task: TaskWithBin): Promise<void> {
    await this.notifications.emitToRole(UserRole.ADMIN, {
      tenantUuid: task.tenantUuid,
      kind: NotificationKind.task_auto,
      title: `Tarefa automática: ${task.title}`,
      body: task.description ?? null,
      taskId: task.id,
    });
  }

  private async notifySecurityOfOccurrence(task: TaskWithBin): Promise<void> {
    await this.notifications.emitToRole(UserRole.SEGURANCA, {
      tenantUuid: task.tenantUuid,
      kind: NotificationKind.task_assigned,
      title: `Ocorrencia relatada: ${task.title}`,
      body: task.description ?? null,
      taskId: task.id,
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

  private async assertCameraExists(cameraId: string, tenantUuid: string): Promise<void> {
    const exists = await this.prisma.camera.findFirst({
      where: { id: cameraId, tenantUuid },
      select: { id: true },
    });
    if (!exists) throw new BadRequestException(`Camera ${cameraId} not found`);
  }

  private composeSecurityOccurrenceDescription(
    dto: CreateSecurityOccurrenceDto,
  ): string {
    const details = [
      `Camera: ${dto.cameraCode} - ${dto.cameraName}`,
      `Local informado: ${dto.locationName}`,
      dto.targetLabel ? `Vinculo da camera: ${dto.targetLabel}` : null,
    ].filter((line): line is string => !!line);

    const userDescription = dto.description?.trim();
    return [userDescription || null, details.join('\n')]
      .filter((section): section is string => !!section)
      .join('\n\n');
  }

  private assertAssigneeRole(role: UserRole | undefined): void {
    if (!isTaskAssigneeRole(role)) {
      throw new BadRequestException('Selecione um tipo de funcionário válido para a tarefa.');
    }
  }

  private assertTrashBinAssigneeRole(
    trashBinId: string | null | undefined,
    role: UserRole | null | undefined,
  ): void {
    if (trashBinId && role !== UserRole.LIMPEZA) {
      throw new BadRequestException(
        'Tarefas vinculadas a uma lixeira devem ser atribuídas ao time de limpeza.',
      );
    }
  }

  private assertCanUpdate(
    actorRole: UserRole | undefined,
    currentStatus: TaskStatus,
    dto: UpdateTaskDto,
  ): void {
    if (actorRole === UserRole.ADMIN) return;

    if (!isEmployeeRole(actorRole)) {
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
