import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface TasksReportFilter {
  from?: string;
  to?: string;
  trashBinId?: string;
  startedById?: string;
}

const COLUMNS = [
  'id',
  'title',
  'status',
  'priority',
  'kind',
  'assigneeName',
  'startedBy',
  'startedAt',
  'completedAt',
  'dueDate',
  'createdAt',
  'trashBinCode',
  'durationMinutes',
  'onTime',
] as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async tasksCsv(tenantUuid: string, filter: TasksReportFilter): Promise<string> {
    const where: Prisma.TaskWhereInput = { tenantUuid };
    if (filter.trashBinId) where.trashBinId = filter.trashBinId;
    if (filter.startedById) where.startedById = filter.startedById;
    if (filter.from || filter.to) {
      where.createdAt = {
        ...(filter.from ? { gte: new Date(filter.from) } : {}),
        ...(filter.to ? { lte: new Date(filter.to) } : {}),
      };
    }

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        trashBin: { select: { code: true } },
        startedBy: { select: { name: true } },
      },
    });

    const rows: string[] = [COLUMNS.join(',')];
    for (const t of tasks) {
      const durationMinutes =
        t.startedAt && t.completedAt
          ? Math.round((t.completedAt.getTime() - t.startedAt.getTime()) / 60_000)
          : '';
      const onTime =
        t.completedAt && t.dueDate
          ? t.completedAt.getTime() <= t.dueDate.getTime()
            ? 'true'
            : 'false'
          : '';
      const cells = [
        t.id,
        t.title,
        t.status,
        t.priority,
        t.kind,
        t.assigneeName ?? '',
        t.startedBy?.name ?? '',
        t.startedAt?.toISOString() ?? '',
        t.completedAt?.toISOString() ?? '',
        t.dueDate?.toISOString() ?? '',
        t.createdAt.toISOString(),
        t.trashBin?.code ?? '',
        durationMinutes,
        onTime,
      ];
      rows.push(cells.map(csvCell).join(','));
    }
    return rows.join('\n');
  }
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
