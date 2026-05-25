import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Task, TrashBin } from '../types';
import { ErrorState, LoadingState } from '../components/States';
import { formatRelativeTime } from '../lib/format';
import { TaskPriorityBadge, TaskStatusBadge, TrashBinStatusBadge } from '../components/StatusBadge';
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function DashboardPage() {
  const [bins, setBins] = useState<TrashBin[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([api.trashBins.list(), api.tasks.list()])
      .then(([b, t]) => {
        if (cancelled) return;
        setBins(b);
        setTasks(t);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Falha ao carregar dados');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    if (!bins || !tasks) return null;
    const totalBins = bins.length;
    const fullBins = bins.filter((b) => b.status === 'full').length;
    const lowBattery = bins.filter(
      (b) => b.batteryLevel !== null && b.batteryLevel <= 15,
    ).length;
    const pendingTasks = tasks.filter(
      (t) => t.status === 'pending' || t.status === 'in_progress',
    ).length;
    return { totalBins, fullBins, lowBattery, pendingTasks };
  }, [bins, tasks]);

  const attentionBins = useMemo(() => {
    if (!bins) return [];
    return bins
      .filter(
        (b) =>
          b.status === 'full' ||
          b.status === 'offline' ||
          (b.batteryLevel !== null && b.batteryLevel <= 15),
      )
      .slice(0, 5);
  }, [bins]);

  const upcomingTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter((t) => t.status === 'pending' || t.status === 'in_progress')
      .slice(0, 5);
  }, [tasks]);

  if (error) return <ErrorState message={error} />;
  if (!stats) return <LoadingState />;

  const statCards = [
    { label: 'Total de lixeiras', value: stats.totalBins, hint: 'Cadastradas no sistema', accent: 'text-primary' },
    { label: 'Lixeiras cheias', value: stats.fullBins, hint: 'Precisam de coleta', accent: 'text-destructive' },
    { label: 'Bateria baixa', value: stats.lowBattery, hint: 'Sensores ≤ 15%', accent: 'text-amber-500' },
    { label: 'Tarefas pendentes', value: stats.pendingTasks, hint: 'Em andamento ou abertas', accent: 'text-blue-500' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visão geral da operação</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${s.accent}`}>{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Lixeiras que precisam de atenção</h2>
          {attentionBins.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
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
                    <TableHead>Última leitura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attentionBins.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{b.code}</span>
                      </TableCell>
                      <TableCell>{b.name}</TableCell>
                      <TableCell>
                        <TrashBinStatusBadge status={b.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatRelativeTime(b.lastSeenAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Próximas tarefas</h2>
          {upcomingTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingTasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell>
                        <TaskStatusBadge status={t.status} />
                      </TableCell>
                      <TableCell>
                        <TaskPriorityBadge priority={t.priority} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
