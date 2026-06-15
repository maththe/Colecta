import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Download,
  Minus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, ApiError } from '@/lib/api';
import type { BinActivityRow, ThroughputBucket } from '@/types';
import { ErrorState } from '@/components/States';
import { StatCard } from '@/components/StatCard';
import { useAsyncData } from '@/hooks/useAsyncData';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FilterChips } from '@/components/ui/filter-chips';
import { cn } from '@/lib/utils';

type RangePreset = '7d' | '30d' | '90d';

const PRESETS: { value: RangePreset; label: string; days: number }[] = [
  { value: '7d', label: 'Últimos 7 dias', days: 7 },
  { value: '30d', label: 'Últimos 30 dias', days: 30 },
  { value: '90d', label: 'Últimos 90 dias', days: 90 },
];

const CHART_COLORS = {
  border: 'var(--border)',
  muted: 'var(--muted)',
  mutedForeground: 'var(--muted-foreground)',
  primary: 'var(--primary)',
} as const;

function rangeFor(preset: RangePreset): { from: string; to: string } {
  const days = PRESETS.find((p) => p.value === preset)!.days;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 3600_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const minutes = ms / 60_000;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${Math.round(value * 100)}%`;
}

function formatWeek(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Trend arrow + label comparing current vs previous period value
function Trend({
  current,
  previous,
  invert = false,
}: {
  current: number | null;
  previous: number | null;
  invert?: boolean;
}) {
  if (current === null || previous === null || previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const isPositive = delta > 0;
  const isGood = invert ? !isPositive : isPositive;
  const abs = Math.abs(delta);

  if (abs < 1) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        Estável
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
      )}
    >
      {isPositive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {abs.toFixed(0)}% vs período anterior
    </span>
  );
}

// Custom tooltip for recharts
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs">
      <p className="mb-1.5 font-medium text-foreground">Semana de {label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function ThroughputChart({ data }: { data: ThroughputBucket[] }) {
  const chartData = useMemo(
    () => data.map((b) => ({ week: formatWeek(b.weekStart), Criadas: b.created, Concluídas: b.completed })),
    [data],
  );

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} barCategoryGap="30%" barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={CHART_COLORS.border} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11, fill: CHART_COLORS.mutedForeground }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: CHART_COLORS.mutedForeground }}
          axisLine={false}
          tickLine={false}
          width={28}
          allowDecimals={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART_COLORS.muted, radius: 4 }} />
        <Bar
          dataKey="Criadas"
          fill={CHART_COLORS.mutedForeground}
          fillOpacity={0.4}
          radius={[3, 3, 0, 0]}
        />
        <Bar dataKey="Concluídas" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BinActivityChart({ data }: { data: BinActivityRow[] }) {
  const chartData = useMemo(
    () =>
      data.map((r) => ({
        name: r.code,
        label: r.name,
        Concluídas: r.completed,
        'Em aberto': r.pending,
      })),
    [data],
  );

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 36)}>
      <BarChart data={chartData} layout="vertical" barCategoryGap="25%" barGap={2}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={CHART_COLORS.border} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: CHART_COLORS.mutedForeground }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: CHART_COLORS.mutedForeground }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const row = chartData.find((d) => d.name === label);
            return (
              <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs">
                <p className="mb-1 font-medium text-foreground">{row?.label ?? label}</p>
                {payload.map((p) => (
                  <p key={p.name} className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color as string }} />
                    {p.name}: <span className="font-medium text-foreground">{p.value}</span>
                  </p>
                ))}
              </div>
            );
          }}
          cursor={{ fill: CHART_COLORS.muted, radius: 4 }}
        />
        <Bar dataKey="Concluídas" fill={CHART_COLORS.primary} radius={[0, 3, 3, 0]}>
          {chartData.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS.primary} />
          ))}
        </Bar>
        <Bar
          dataKey="Em aberto"
          fill={CHART_COLORS.mutedForeground}
          fillOpacity={0.35}
          radius={[0, 3, 3, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function OnTimeBar({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(rate * 100);
  const color = pct >= 80 ? 'bg-primary' : pct >= 60 ? 'bg-amber-500' : 'bg-destructive';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function AnalyticsPage() {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    const range = rangeFor(preset);
    const [summary, productivity, throughput, binActivity] = await Promise.all([
      api.analytics.summary(range),
      api.analytics.productivity(range),
      api.analytics.throughput(12),
      api.analytics.bins(range),
    ]);
    return { summary, productivity, throughput, binActivity };
  }, [preset]);

  const {
    data,
    error,
    refreshing,
    reload: load,
  } = useAsyncData(fetchAnalytics, 'Falha ao carregar analytics');
  const summary = data?.summary ?? null;
  const productivity = data?.productivity ?? null;
  const throughput = data?.throughput ?? null;
  const binActivity = data?.binActivity ?? null;

  const exportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await api.reports.tasksCsv(rangeFor(preset));
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Falha ao exportar relatório');
    } finally {
      setExporting(false);
    }
  };

  const topBin = useMemo(
    () => (binActivity && binActivity.length > 0 ? binActivity[0] : null),
    [binActivity],
  );

  if (error || exportError) return <ErrorState message={error ?? exportError ?? ''} />;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Produtividade e SLA do time de campo
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChips options={PRESETS} value={preset} onChange={setPreset} />
          <Button variant="outline" size="sm" onClick={() => void exportCsv()} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
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
        </div>
      </header>

      {/* KPI Summary */}
      {!summary ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardDescription>Concluídas no período</CardDescription>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <p className="text-3xl font-bold tabular-nums">{summary.completed}</p>
              <Trend current={summary.completed} previous={summary.previousPeriod.completed} />
              <p className="text-xs text-muted-foreground">{summary.withDueDate} com prazo definido</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardDescription>Tempo médio de resolução</CardDescription>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <p className="text-3xl font-bold tabular-nums">
                {formatDuration(summary.avgResolutionMs)}
              </p>
              <Trend
                current={summary.avgResolutionMs}
                previous={summary.previousPeriod.avgResolutionMs}
                invert
              />
              <p className="text-xs text-muted-foreground">início → conclusão</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardDescription>Cumprimento de prazo</CardDescription>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <p className="text-3xl font-bold tabular-nums">
                {formatPercent(summary.onTimeRate)}
              </p>
              <Trend
                current={summary.onTimeRate}
                previous={summary.previousPeriod.onTimeRate}
              />
              <p className="text-xs text-muted-foreground">
                {summary.onTime}/{summary.withDueDate} dentro do prazo
              </p>
            </CardContent>
          </Card>

          <StatCard
            label="Em aberto e atrasadas"
            value={summary.openOverdue}
            hint="Atualmente"
            Icon={AlertTriangle}
            tone={summary.openOverdue > 0 ? 'destructive' : 'warning'}
          />
        </div>
      )}

      {/* Throughput + Bin Activity side by side */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Tarefas por semana</CardTitle>
                <CardDescription>
                  Últimas 12 semanas — criadas (cinza) vs concluídas (verde)
                </CardDescription>
              </div>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {!throughput ? (
              <div className="h-44 animate-pulse rounded-lg bg-muted" />
            ) : (
              <ThroughputChart data={throughput} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Lixeiras mais ativas</CardTitle>
                <CardDescription>Tarefas concluídas (verde) e em aberto</CardDescription>
              </div>
              <Trash2 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {!binActivity ? (
              <div className="h-44 animate-pulse rounded-lg bg-muted" />
            ) : binActivity.length === 0 ? (
              <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
                Sem dados no período
              </div>
            ) : (
              <BinActivityChart data={binActivity} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Productivity table */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Produtividade por funcionário</h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {!productivity ? (
            <div className="h-32 animate-pulse bg-muted" />
          ) : productivity.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhuma tarefa concluída no período selecionado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="text-right">Concluídas</TableHead>
                  <TableHead className="text-right">Tempo médio</TableHead>
                  <TableHead>No prazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productivity.map((row, idx) => {
                  const rate = row.withDueDate > 0 ? row.onTime / row.withDueDate : null;
                  return (
                    <TableRow key={row.userId ?? 'unassigned'}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {idx < 3 && (
                            <span
                              className={cn(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                                idx === 0
                                  ? 'bg-amber-400/20 text-amber-600'
                                  : idx === 1
                                    ? 'bg-slate-300/30 text-slate-500'
                                    : 'bg-orange-300/20 text-orange-600',
                              )}
                            >
                              {idx + 1}
                            </span>
                          )}
                          {row.userName ?? (
                            <span className="text-muted-foreground">Sem responsável</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {row.completed}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatDuration(row.avgResolutionMs)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <OnTimeBar rate={rate} />
                          {rate !== null && (
                            <span className="text-[10px] text-muted-foreground">
                              {row.onTime}/{row.withDueDate}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* Highlight card - most active bin */}
      {topBin && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-4 pt-5 pb-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Trash2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                Lixeira mais demandada no período:{' '}
                <span className="font-mono">{topBin.code}</span> — {topBin.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {topBin.completed} tarefas concluídas
                {topBin.pending > 0 && ` · ${topBin.pending} em aberto`}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
