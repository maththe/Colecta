import { Injectable } from '@nestjs/common';
import { TaskStatus, TrashBinStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AnalyticsRange {
  from: Date;
  to: Date;
}

interface ProductivityRow {
  userId: string | null;
  userName: string | null;
  completed: number;
  avgResolutionMs: number | null;
  onTime: number;
  withDueDate: number;
}

interface ThroughputBucket {
  weekStart: string;
  completed: number;
  created: number;
}

export interface BinActivityRow {
  binId: string;
  code: string;
  name: string;
  completed: number;
  pending: number;
}

export interface ZoneBinsRow {
  zoneId: string | null;
  zoneName: string;
  color: string | null;
  binCount: number;
  fullCount: number;
  avgFillLevel: number | null;
}

const DEFAULT_RANGE_DAYS = 30;
const DEFAULT_THROUGHPUT_WEEKS = 12;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  buildRange(from?: string, to?: string): AnalyticsRange {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - DEFAULT_RANGE_DAYS * 24 * 3600_000);
    return { from: fromDate, to: toDate };
  }

  private previousRange(range: AnalyticsRange): AnalyticsRange {
    const span = range.to.getTime() - range.from.getTime();
    return { from: new Date(range.from.getTime() - span), to: new Date(range.from) };
  }

  private async computeSummaryMetrics(tenantUuid: string, range: AnalyticsRange) {
    const completedTasks = await this.prisma.task.findMany({
      where: {
        tenantUuid,
        status: TaskStatus.done,
        completedAt: { gte: range.from, lte: range.to },
      },
      select: { startedAt: true, completedAt: true, dueDate: true },
    });

    const resolutionTimes: number[] = [];
    let onTime = 0;
    let withDueDate = 0;

    for (const t of completedTasks) {
      if (t.startedAt && t.completedAt) {
        resolutionTimes.push(t.completedAt.getTime() - t.startedAt.getTime());
      }
      if (t.dueDate && t.completedAt) {
        withDueDate += 1;
        if (t.completedAt.getTime() <= t.dueDate.getTime()) onTime += 1;
      }
    }

    const avgResolutionMs =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : null;

    return {
      completed: completedTasks.length,
      avgResolutionMs,
      onTimeRate: withDueDate > 0 ? onTime / withDueDate : null,
      onTime,
      withDueDate,
    };
  }

  async summary(tenantUuid: string, range: AnalyticsRange) {
    const [current, previous] = await Promise.all([
      this.computeSummaryMetrics(tenantUuid, range),
      this.computeSummaryMetrics(tenantUuid, this.previousRange(range)),
    ]);

    const now = new Date();
    const openOverdue = await this.prisma.task.count({
      where: {
        tenantUuid,
        status: { in: [TaskStatus.pending, TaskStatus.in_progress] },
        dueDate: { lt: now },
      },
    });

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      ...current,
      openOverdue,
      previousPeriod: {
        completed: previous.completed,
        avgResolutionMs: previous.avgResolutionMs,
        onTimeRate: previous.onTimeRate,
      },
    };
  }

  async productivity(tenantUuid: string, range: AnalyticsRange): Promise<ProductivityRow[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        tenantUuid,
        status: TaskStatus.done,
        completedAt: { gte: range.from, lte: range.to },
      },
      select: {
        startedAt: true,
        completedAt: true,
        dueDate: true,
        startedById: true,
        startedBy: { select: { id: true, name: true } },
      },
    });

    const groups = new Map<string, ProductivityRow>();
    const durations = new Map<string, number[]>();

    for (const t of tasks) {
      const key = t.startedById ?? '__unassigned__';
      if (!groups.has(key)) {
        groups.set(key, {
          userId: t.startedById,
          userName: t.startedBy?.name ?? null,
          completed: 0,
          avgResolutionMs: null,
          onTime: 0,
          withDueDate: 0,
        });
        durations.set(key, []);
      }
      const row = groups.get(key)!;
      row.completed += 1;
      if (t.startedAt && t.completedAt) {
        durations.get(key)!.push(t.completedAt.getTime() - t.startedAt.getTime());
      }
      if (t.dueDate && t.completedAt) {
        row.withDueDate += 1;
        if (t.completedAt.getTime() <= t.dueDate.getTime()) row.onTime += 1;
      }
    }

    for (const [key, row] of groups) {
      const arr = durations.get(key)!;
      row.avgResolutionMs =
        arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    }

    return [...groups.values()].sort((a, b) => b.completed - a.completed);
  }

  async throughput(
    tenantUuid: string,
    weeks = DEFAULT_THROUGHPUT_WEEKS,
  ): Promise<ThroughputBucket[]> {
    const now = new Date();
    const startOfThisWeek = startOfIsoWeek(now);
    const from = new Date(
      startOfThisWeek.getTime() - (weeks - 1) * 7 * 24 * 3600_000,
    );

    const [created, completed] = await Promise.all([
      this.prisma.task.findMany({
        where: { tenantUuid, createdAt: { gte: from } },
        select: { createdAt: true },
      }),
      this.prisma.task.findMany({
        where: {
          tenantUuid,
          status: TaskStatus.done,
          completedAt: { gte: from },
        },
        select: { completedAt: true },
      }),
    ]);

    const buckets = new Map<string, ThroughputBucket>();
    for (let i = 0; i < weeks; i += 1) {
      const weekStart = new Date(from.getTime() + i * 7 * 24 * 3600_000);
      const key = weekStart.toISOString().slice(0, 10);
      buckets.set(key, { weekStart: key, completed: 0, created: 0 });
    }

    const bump = (
      list: { createdAt?: Date; completedAt?: Date | null }[],
      field: 'created' | 'completed',
      dateField: 'createdAt' | 'completedAt',
    ): void => {
      for (const item of list) {
        const date = item[dateField];
        if (!date) continue;
        const key = startOfIsoWeek(date).toISOString().slice(0, 10);
        const bucket = buckets.get(key);
        if (bucket) bucket[field] += 1;
      }
    };
    bump(created, 'created', 'createdAt');
    bump(completed, 'completed', 'completedAt');

    return [...buckets.values()];
  }

  async binActivity(tenantUuid: string, range: AnalyticsRange): Promise<BinActivityRow[]> {
    const [doneTasks, openTasks] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          tenantUuid,
          status: TaskStatus.done,
          completedAt: { gte: range.from, lte: range.to },
          trashBinId: { not: null },
        },
        select: { trashBinId: true, trashBin: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.task.findMany({
        where: {
          tenantUuid,
          status: { in: [TaskStatus.pending, TaskStatus.in_progress] },
          trashBinId: { not: null },
        },
        select: { trashBinId: true, trashBin: { select: { id: true, code: true, name: true } } },
      }),
    ]);

    const rows = new Map<string, BinActivityRow>();

    for (const t of doneTasks) {
      if (!t.trashBinId || !t.trashBin) continue;
      if (!rows.has(t.trashBinId)) {
        rows.set(t.trashBinId, { binId: t.trashBin.id, code: t.trashBin.code, name: t.trashBin.name, completed: 0, pending: 0 });
      }
      rows.get(t.trashBinId)!.completed += 1;
    }

    for (const t of openTasks) {
      if (!t.trashBinId || !t.trashBin) continue;
      if (!rows.has(t.trashBinId)) {
        rows.set(t.trashBinId, { binId: t.trashBin.id, code: t.trashBin.code, name: t.trashBin.name, completed: 0, pending: 0 });
      }
      rows.get(t.trashBinId)!.pending += 1;
    }

    return [...rows.values()]
      .sort((a, b) => b.completed + b.pending - (a.completed + a.pending))
      .slice(0, 10);
  }

  /**
   * Distribuição das lixeiras por zona, usando o `zoneId` **persistido** (não
   * recalcula a cada request). Inclui zonas sem lixeiras e um balde "Sem zona"
   * para as lixeiras fora de qualquer zona. Opcionalmente restrito a um Site.
   */
  async binsByZone(tenantUuid: string, siteId?: string): Promise<ZoneBinsRow[]> {
    const siteFilter = siteId ? { siteId } : {};
    const [zones, bins] = await Promise.all([
      this.prisma.zone.findMany({
        where: { tenantUuid, ...siteFilter },
        select: { id: true, name: true, color: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.trashBin.findMany({
        where: { tenantUuid, ...siteFilter },
        select: { zoneId: true, status: true, fillLevel: true },
      }),
    ]);

    const NONE = '__none__';
    const rows = new Map<string, ZoneBinsRow>();
    const fill = new Map<string, { sum: number; count: number }>();
    for (const z of zones) {
      rows.set(z.id, {
        zoneId: z.id,
        zoneName: z.name,
        color: z.color,
        binCount: 0,
        fullCount: 0,
        avgFillLevel: null,
      });
    }

    for (const bin of bins) {
      const key = bin.zoneId ?? NONE;
      if (!rows.has(key)) {
        rows.set(key, {
          zoneId: bin.zoneId,
          zoneName: bin.zoneId ? 'Zona removida' : 'Sem zona',
          color: null,
          binCount: 0,
          fullCount: 0,
          avgFillLevel: null,
        });
      }
      const row = rows.get(key)!;
      row.binCount += 1;
      if (bin.status === TrashBinStatus.full) row.fullCount += 1;
      if (bin.fillLevel != null) {
        const acc = fill.get(key) ?? { sum: 0, count: 0 };
        acc.sum += bin.fillLevel;
        acc.count += 1;
        fill.set(key, acc);
      }
    }

    for (const [key, row] of rows) {
      const acc = fill.get(key);
      row.avgFillLevel = acc && acc.count > 0 ? acc.sum / acc.count : null;
    }

    return [...rows.values()];
  }
}

function startOfIsoWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}
