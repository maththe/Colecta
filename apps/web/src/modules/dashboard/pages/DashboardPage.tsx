import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BatteryLow,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Gauge,
  RefreshCw,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/modules/auth/context/AuthContext';
import type { TrashBin, TrashBinStatus, TaskPriority } from '@/types';
import { TRASH_BIN_STATUS_LABELS } from '@/types';
import { ErrorState } from '@/components/States';
import { StatCard } from '@/components/StatCard';
import { TaskPriorityBadge, TaskStatusBadge } from '@/modules/tasks/components/TaskBadges';
import { TrashBinStatusBadge } from '@/modules/trash-bins/components/TrashBinStatusBadge';
import { useAsyncData } from '@/hooks/useAsyncData';
import { formatRelativeTime } from '@/lib/format';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Order from most to least critical — drives sort and visual emphasis.
const STATUS_PRIORITY: Record<TrashBinStatus, number> = {
  full: 0,
  offline: 1,
  maintenance: 2,
  inactive: 3,
  active: 4,
};

// Color tokens for the fleet-status breakdown bar.
const STATUS_BAR_COLOR: Record<TrashBinStatus, string> = {
  full: 'bg-destructive',
  offline: 'bg-slate-500 dark:bg-slate-400',
  maintenance: 'bg-amber-500',
  inactive: 'bg-muted-foreground/50',
  active: 'bg-primary',
};

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const t = new Date(dueDate).getTime();
  return Number.isFinite(t) && t < Date.now();
}

function formatDueDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

// Slim progress bar — used for fill level. Color escalates with severity.
function FillBar({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 90
      ? 'bg-destructive'
      : pct >= 70
        ? 'bg-amber-500'
        : 'bg-primary';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

function BatteryCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const low = value <= 15;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs tabular-nums',
        low ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
      )}
    >
      {low && <BatteryLow className="h-3.5 w-3.5" />}
      {value}%
    </span>
  );
}

// Stacked bar showing how the fleet is distributed across statuses.
function FleetHealthBar({ bins }: { bins: TrashBin[] }) {
  const total = bins.length;
  if (total === 0) return null;

  const order: TrashBinStatus[] = ['full', 'offline', 'maintenance', 'inactive', 'active'];
  const counts = order
    .map((s) => ({ status: s, count: bins.filter((b) => b.status === s).length }))
    .filter((entry) => entry.count > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardDescription>Saúde da frota</CardDescription>
            <p className="mt-1 text-sm font-medium">
              {bins.filter((b) => b.status === 'active').length} de {total} lixeiras ativas
            </p>
          </div>
          <Gauge className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          {counts.map(({ status, count }) => (
            <div
              key={status}
              className={STATUS_BAR_COLOR[status]}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${TRASH_BIN_STATUS_LABELS[status]}: ${count}`}
            />
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {counts.map(({ status, count }) => (
            <li key={status} className="flex items-center gap-1.5 text-muted-foreground">
              <span className={cn('h-2 w-2 rounded-full', STATUS_BAR_COLOR[status])} />
              <span className="text-foreground">{count}</span>
              <span>{TRASH_BIN_STATUS_LABELS[status].toLowerCase()}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} />;
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <SkeletonBlock className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-28" />
        ))}
      </div>
      <SkeletonBlock className="h-24" />
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonBlock className="h-64" />
        <SkeletonBlock className="h-64" />
      </div>
    </div>
  );
}

async function fetchDashboard() {
  const [bins, tasks] = await Promise.all([api.trashBins.list(), api.tasks.list()]);
  return { bins, tasks, fetchedAt: new Date() };
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    data,
    error,
    refreshing,
    reload: load,
  } = useAsyncData(fetchDashboard, 'Falha ao carregar dados');
  const bins = data?.bins ?? null;
  const tasks = data?.tasks ?? null;
  const lastUpdated = data?.fetchedAt ?? null;

  const stats = useMemo(() => {
    if (!bins || !tasks) return null;
    const totalBins = bins.length;
    const fullBins = bins.filter((b) => b.status === 'full').length;
    const offlineBins = bins.filter((b) => b.status === 'offline').length;
    const lowBattery = bins.filter(
      (b) => b.batteryLevel !== null && b.batteryLevel <= 15,
    ).length;
    const fillSamples = bins
      .map((b) => b.fillLevel)
      .filter((v): v is number => v !== null);
    const avgFill = fillSamples.length
      ? Math.round(fillSamples.reduce((sum, v) => sum + v, 0) / fillSamples.length)
      : null;
    const pendingTasks = tasks.filter(
      (t) => t.status === 'pending' || t.status === 'in_progress',
    ).length;
    const overdueTasks = tasks.filter(
      (t) =>
        (t.status === 'pending' || t.status === 'in_progress') && isOverdue(t.dueDate),
    ).length;
    return {
      totalBins,
      fullBins,
      offlineBins,
      lowBattery,
      avgFill,
      pendingTasks,
      overdueTasks,
    };
  }, [bins, tasks]);

  const attentionBins = useMemo(() => {
    if (!bins) return [];
    return bins
      .filter(
        (b) =>
          b.status === 'full' ||
          b.status === 'offline' ||
          b.status === 'maintenance' ||
          (b.batteryLevel !== null && b.batteryLevel <= 15) ||
          (b.fillLevel !== null && b.fillLevel >= 80),
      )
      .sort((a, b) => {
        const sd = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        if (sd !== 0) return sd;
        return (b.fillLevel ?? 0) - (a.fillLevel ?? 0);
      })
      .slice(0, 5);
  }, [bins]);

  const upcomingTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter((t) => t.status === 'pending' || t.status === 'in_progress')
      .sort((a, b) => {
        const aOverdue = isOverdue(a.dueDate);
        const bOverdue = isOverdue(b.dueDate);
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
        const pd = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
        if (pd !== 0) return pd;
        const at = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bt = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return at - bt;
      })
      .slice(0, 5);
  }, [tasks]);

  if (error) return <ErrorState message={error} />;
  if (!stats || !bins) return <DashboardSkeleton />;

  const firstName = user?.name?.split(' ')[0] ?? 'olá';
  const fullPct = stats.totalBins ? Math.round((stats.fullBins / stats.totalBins) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Olá, {firstName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão geral da operação
            {lastUpdated && (
              <>
                {' · '}
                <span title={lastUpdated.toLocaleString('pt-BR')}>
                  atualizado {formatRelativeTime(lastUpdated.toISOString())}
                </span>
              </>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={refreshing}
          aria-label="Atualizar"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          Atualizar
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total de lixeiras"
          value={stats.totalBins}
          hint={stats.avgFill !== null ? `Preenchimento médio: ${stats.avgFill}%` : 'Cadastradas no sistema'}
          Icon={Trash2}
          tone="primary"
          to="/bins"
        />
        <StatCard
          label="Lixeiras cheias"
          value={stats.fullBins}
          hint={stats.totalBins ? `${fullPct}% da frota precisa de coleta` : 'Precisam de coleta'}
          Icon={AlertTriangle}
          tone="destructive"
          to="/bins"
        />
        <StatCard
          label="Bateria baixa"
          value={stats.lowBattery}
          hint={stats.offlineBins > 0 ? `${stats.offlineBins} offline` : 'Sensores ≤ 15%'}
          Icon={stats.offlineBins > 0 ? WifiOff : BatteryLow}
          tone="warning"
          to="/bins"
        />
        <StatCard
          label="Tarefas pendentes"
          value={stats.pendingTasks}
          hint={
            stats.overdueTasks > 0
              ? `${stats.overdueTasks} em atraso`
              : 'Em andamento ou abertas'
          }
          Icon={stats.overdueTasks > 0 ? AlertTriangle : ClipboardList}
          tone={stats.overdueTasks > 0 ? 'destructive' : 'info'}
          to="/tasks"
        />
      </div>

      <FleetHealthBar bins={bins} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Lixeiras que precisam de atenção</h2>
            <Link
              to="/bins"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {attentionBins.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-10 text-sm text-muted-foreground">
              <CheckSquare className="mb-2 h-6 w-6 text-primary" />
              Nenhuma lixeira em alerta
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Preenchimento</TableHead>
                    <TableHead>Bateria</TableHead>
                    <TableHead>Última leitura</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attentionBins.map((b) => (
                    <TableRow
                      key={b.id}
                      onClick={() => navigate(`/map?bin=${b.id}`)}
                      className="group cursor-pointer"
                    >
                      <TableCell>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {b.code}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell>
                        <TrashBinStatusBadge status={b.status} />
                      </TableCell>
                      <TableCell>
                        <FillBar value={b.fillLevel} />
                      </TableCell>
                      <TableCell>
                        <BatteryCell value={b.batteryLevel} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelativeTime(b.lastSeenAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Próximas tarefas</h2>
            <Link
              to="/tasks"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {upcomingTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-10 text-sm text-muted-foreground">
              <CheckSquare className="mb-2 h-6 w-6 text-primary" />
              Nenhuma tarefa em aberto
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingTasks.map((t) => {
                    const overdue = isOverdue(t.dueDate);
                    return (
                      <TableRow
                        key={t.id}
                        onClick={() => navigate(`/tasks?task=${t.id}`)}
                        className="group cursor-pointer"
                      >
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{t.title}</span>
                            {t.trashBin ? (
                              <span className="text-xs font-normal text-muted-foreground">
                                <span className="font-mono">{t.trashBin.code}</span>
                                {' · '}
                                {t.trashBin.name}
                              </span>
                            ) : t.location ? (
                              <span className="text-xs font-normal text-muted-foreground">
                                {t.location.name}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TaskStatusBadge status={t.status} />
                        </TableCell>
                        <TableCell>
                          <TaskPriorityBadge priority={t.priority} />
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-xs tabular-nums',
                            overdue
                              ? 'font-medium text-destructive'
                              : 'text-muted-foreground',
                          )}
                        >
                          {t.dueDate ? formatDueDate(t.dueDate) : '—'}
                          {overdue && <span className="ml-1">(atrasada)</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
