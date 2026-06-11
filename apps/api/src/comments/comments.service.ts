import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MENTION_REGEX = /@([a-zA-Z0-9._\-À-ſ]+)/g;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(taskId: string, tenantUuid: string) {
    await this.assertTaskExists(taskId, tenantUuid);
    return this.prisma.taskComment.findMany({
      where: { taskId, tenantUuid },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true } },
      },
    });
  }

  async create(
    taskId: string,
    tenantUuid: string,
    authorId: string | undefined,
    body: string,
  ) {
    if (!authorId) throw new ForbiddenException('Autor não identificado.');
    const text = body?.trim();
    if (!text) throw new BadRequestException('Comentário vazio.');
    if (text.length > 2000) throw new BadRequestException('Comentário muito longo.');

    await this.assertTaskExists(taskId, tenantUuid);

    return this.prisma.taskComment.create({
      data: {
        tenantUuid,
        taskId,
        authorId,
        body: text,
        mentions: extractMentions(text),
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });
  }

  private async assertTaskExists(taskId: string, tenantUuid: string) {
    const exists = await this.prisma.task.findFirst({
      where: { id: taskId, tenantUuid },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Tarefa não encontrada.');
  }
}

function extractMentions(text: string): string[] {
  const tokens = new Set<string>();
  for (const match of text.matchAll(MENTION_REGEX)) {
    const token = match[1]?.trim();
    if (token && token.length >= 2) tokens.add(token);
  }
  return [...tokens];
}
