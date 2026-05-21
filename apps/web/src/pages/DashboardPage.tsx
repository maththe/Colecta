import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Task, TrashBin } from '../types';
import { ErrorState, LoadingState } from '../components/States';
import { formatRelativeTime } from '../lib/format';
import { TaskPriorityBadge, TaskStatusBadge, TrashBinStatusBadge } from '../components/StatusBadge';

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

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral da operação</p>
        </div>
      </div>

      <section className="cards-grid">
        <div className="card card--accent-primary">
          <p className="card__label">Total de lixeiras</p>
          <p className="card__value">{stats.totalBins}</p>
          <p className="card__hint">Cadastradas no sistema</p>
        </div>
        <div className="card card--accent-danger">
          <p className="card__label">Lixeiras cheias</p>
          <p className="card__value">{stats.fullBins}</p>
          <p className="card__hint">Precisam de coleta</p>
        </div>
        <div className="card card--accent-warning">
          <p className="card__label">Bateria baixa</p>
          <p className="card__value">{stats.lowBattery}</p>
          <p className="card__hint">Sensores ≤ 15%</p>
        </div>
        <div className="card card--accent-info">
          <p className="card__label">Tarefas pendentes</p>
          <p className="card__value">{stats.pendingTasks}</p>
          <p className="card__hint">Em andamento ou abertas</p>
        </div>
      </section>

      <div
        style={{
          marginTop: 32,
          display: 'grid',
          gap: 24,
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        }}
      >
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Lixeiras que precisam de atenção</h2>
          {attentionBins.length === 0 ? (
            <div className="state">Nenhuma lixeira em alerta</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>Status</th>
                    <th>Última leitura</th>
                  </tr>
                </thead>
                <tbody>
                  {attentionBins.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <span className="mono">{b.code}</span>
                      </td>
                      <td>{b.name}</td>
                      <td>
                        <TrashBinStatusBadge status={b.status} />
                      </td>
                      <td className="nowrap muted">{formatRelativeTime(b.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Próximas tarefas</h2>
          {upcomingTasks.length === 0 ? (
            <div className="state">Nenhuma tarefa em aberto</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Status</th>
                    <th>Prioridade</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingTasks.map((t) => (
                    <tr key={t.id}>
                      <td>{t.title}</td>
                      <td>
                        <TaskStatusBadge status={t.status} />
                      </td>
                      <td>
                        <TaskPriorityBadge priority={t.priority} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
