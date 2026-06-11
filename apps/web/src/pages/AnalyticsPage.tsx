import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type {
  AnalyticsSummary,
  ProductivityRow,
  ThroughputBucket,
} from '../types';
import { ErrorState } from '../components/States';
import { StatCard } from '../components/StatCard';
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
import { cn } from '@/lib/utils';

type RangePreset = '7d' | '30d' | '90d';

const PRESETS: { value: RangePreset; label: string; days: number }[] = [
  { value: '7d', label: 'Últimos 7 dias', days: 7 },
  { value: '30d', label: 'Últimos 30 dias', days: 30 },
  { value: '90d', label: 'Últimos 90 dias', days: 90 },
];

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
  const days = hours / 24;
  return `${days.toFixed(1)} d`;
}

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${Math.round(value * 100)}%`;
}

function formatWeek(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function ThroughputChart({ data }: { data: ThroughputBucket[] }) {
  const max = useMemo(
    () =>
      data.reduce(
        (m, b) => Math.max(m, b.completed, b.created),
        1,
      ),
    [data],
  );
  return (
    <div className="flex items-end gap-2 px-1">
      {data.map((bucket) => {
        const completedH = (bucket.completed / max) * 100;
        const createdH = (bucket.created / max) * 100;
        return (
          <div
            key={bucket.weekStart}
            className="flex flex-1 flex-col items-center gap-1.5"
            title={`Semana de ${formatWeek(bucket.weekStart)} — criadas: ${bucket.created}, concluídas: ${bucket.completed}`}
          >
            <div className="flex h-32 w-full items-end gap-0.5">
              <div
                className="flex-1 rounded-t bg-muted-foreground/40 transition-all"
                style={{ height: `${createdH}%` }}
              />
              <div
                className="flex-1 rounded-t bg-primary transition-all"
                style={{ height: `${completedH}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {formatWeek(bucket.weekStart)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AnalyticsPage() {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [productivity, setProductivity] = useState<ProductivityRow[] | null>(null);
  const [throughput, setThroughput] = useState<ThroughputBucket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const range = rangeFor(preset);
      const [s, p, t] = await Promise.all([
        api.analytics.summary(range),
        api.analytics.productivity(range),
        api.analytics.throughput(12),
      ]);
      setSummary(s);
      setProductivity(p);
      setThroughput(t);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar analytics');
    } finally {
      setRefreshing(false);
    }
  }, [preset]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.reports.tasksCsv(rangeFor(preset));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao exportar relatório');
    } finally {
      setExporting(false);
    }
  };

  if (error) return <ErrorState message={error} />;

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
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPreset(p.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  preset === p.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void exportCsv()}
            disabled={exporting}
          >
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

      {!summary ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Concluídas no período"
            value={summary.completed}
            hint={`${summary.withDueDate} com prazo definido`}
            Icon={CheckCircle2}
            tone="primary"
          />
          <StatCard
            label="Tempo médio de resolução"
            value={formatDuration(summary.avgResolutionMs)}
            hint="início → conclusão"
            Icon={Clock}
            tone="info"
          />
          <StatCard
            label="Cumprimento de prazo"
            value={formatPercent(summary.onTimeRate)}
            hint={`${summary.onTime}/${summary.withDueDate} dentro do prazo`}
            Icon={TrendingUp}
            tone="primary"
          />
          <StatCard
            label="Em aberto e atrasadas"
            value={summary.openOverdue}
            hint="Atualmente"
            Icon={AlertTriangle}
            tone={summary.openOverdue > 0 ? 'destructive' : 'warning'}
          />
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Tarefas por semana</CardTitle>
              <CardDescription>Últimas 12 semanas — criadas (cinza) vs concluídas (verde)</CardDescription>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {!throughput ? (
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
          ) : (
            <ThroughputChart data={throughput} />
          )}
        </CardContent>
      </Card>

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
                  <TableHead className="text-right">No prazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productivity.map((row) => (
                  <TableRow key={row.userId ?? 'unassigned'}>
                    <TableCell className="font-medium">
                      {row.userName ?? (
                        <span className="text-muted-foreground">Sem responsável</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.completed}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(row.avgResolutionMs)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.withDueDate === 0
                        ? '—'
                        : `${formatPercent(row.onTime / row.withDueDate)} (${row.onTime}/${row.withDueDate})`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
