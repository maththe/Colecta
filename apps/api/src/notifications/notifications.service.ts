import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationKind, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface EmitInput {
  tenantUuid: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  taskId?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, tenantUuid: string, onlyUnread = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        tenantUuid,
        ...(onlyUnread ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string, tenantUuid: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, tenantUuid, readAt: null },
    });
  }

  async markRead(id: string, userId: string, tenantUuid: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId, tenantUuid },
    });
    if (!existing) throw new NotFoundException('Notificação não encontrada.');
    if (existing.readAt) return existing;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string, tenantUuid: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, tenantUuid, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async emitToUsers(userIds: string[], input: EmitInput): Promise<void> {
    if (userIds.length === 0) return;
    const data: Prisma.NotificationCreateManyInput[] = userIds.map((userId) => ({
      tenantUuid: input.tenantUuid,
      userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      taskId: input.taskId ?? null,
    }));
    await this.prisma.notification.createMany({ data });
  }

  async emitToRole(role: UserRole, input: EmitInput, exceptUserId?: string): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: {
        tenantUuid: input.tenantUuid,
        role,
        ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}),
      },
      select: { id: true },
    });
    await this.emitToUsers(
      users.map((u) => u.id),
      input,
    );
  }

  async findUsersByAssigneeName(
    name: string,
    tenantUuid: string,
  ): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        tenantUuid,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }
}
