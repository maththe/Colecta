import { useMemo, useState } from 'react';
import type { Task, TaskStatus } from '../../types';
import { TASK_STATUS_LABELS } from '../../types';
import { sortTasks } from '../../lib/task';
import { ApiError } from '../../lib/api';
import { ConfirmDialog } from '../ConfirmDialog';
import { TaskCard } from './TaskCard';
import { TaskDetailsModal } from './TaskDetailsModal';
import {
  DEFAULT_TASK_FILTERS,
  TaskBoardFilters,
  taskMatchesFilters,
  type TaskBoardFilterState,
} from './TaskBoardFilters';
import type { AdminActions, TaskStatusChangeHandler } from './types';
import { cn } from '@/lib/utils';

const COLUMNS: { status: TaskStatus; dot: string; ring: string }[] = [
  { status: 'pending', dot: 'bg-amber-500', ring: 'ring-amber-500/20' },
  { status: 'in_progress', dot: 'bg-blue-500', ring: 'ring-blue-500/20' },
  { status: 'done', dot: 'bg-primary', ring: 'ring-primary/20' },
  { status: 'cancelled', dot: 'bg-muted-foreground', ring: 'ring-foreground/10' },
];

function describeStatusError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'Você não tem permissão para alterar esta tarefa.';
    if (err.status === 400) return err.message || 'Transição inválida.';
    if (err.message) return err.message;
  }
  return 'Não foi possível atualizar a tarefa. Tente novamente.';
}

export function TasksBoard({
  tasks,
  onStatusChange,
  canManage,
  onEdit,
  onDelete,
}: {
  tasks: Task[];
  onStatusChange: TaskStatusChangeHandler;
} & AdminActions) {
  const [selected, setSelected] = useState<Task | null>(null);
  // Fecha o modal de detalhe antes de abrir o formulário/confirmação, evitando
  // modais empilhados ou um detalhe "fantasma" sobre uma tarefa já excluída.
  const admin: AdminActions = {
    canManage,
    onEdit: onEdit ? (t) => { setSelected(null); onEdit(t); } : undefined,
    onDelete: onDelete ? (t) => { setSelected(null); onDelete(t); } : undefined,
  };
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ task: Task; status: TaskStatus } | null>(
    null,
  );
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskBoardFilterState>(DEFAULT_TASK_FILTERS);

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      pending: [],
      in_progress: [],
      done: [],
      cancelled: [],
    };
    for (const task of tasks) {
      if (taskMatchesFilters(task, filters)) map[task.status]?.push(task);
    }
    for (const status of Object.keys(map) as TaskStatus[]) {
      map[status] = sortTasks(map[status]);
    }
    return map;
  }, [filters, tasks]);

  const visibleColumns =
    filters.status === 'all' ? COLUMNS : COLUMNS.filter((c) => c.status === filters.status);
  const visibleTaskCount = visibleColumns.reduce((sum, col) => sum + grouped[col.status].length, 0);
  const hasResults = visibleTaskCount > 0;

  async function handleStatusChange(task: Task, status: TaskStatus): Promise<Task> {
    setUpdatingTaskId(task.id);
    setActionError(null);
    try {
      const updated = await onStatusChange(task, status);
      setSelected((current) => (current?.id === task.id ? updated : current));
      return updated;
    } catch (err) {
      setActionError(describeStatusError(err));
      throw err;
    } finally {
      setUpdatingTaskId(null);
    }
  }

  function handleRequestStatusChange(task: Task, status: TaskStatus) {
    setConfirmError(null);
    setPendingAction({ task, status });
  }

  async function handleConfirmStatusChange() {
    if (!pendingAction) return;
    setConfirmError(null);
    try {
      await handleStatusChange(pendingAction.task, pendingAction.status);
      setPendingAction(null);
    } catch (err) {
      setConfirmError(describeStatusError(err));
    }
  }

  function handleCancelStatusChange() {
    setPendingAction(null);
    setConfirmError(null);
  }

  const pendingIsStart = pendingAction?.status === 'in_progress';
  const confirmTitle = pendingIsStart ? 'Iniciar tarefa' : 'Concluir tarefa';
  const confirmDescription = pendingIsStart
    ? 'Sua identificação será registrada como responsável pela execução desta tarefa.'
    : 'Marcar esta tarefa como concluída?';
  const confirmLabel = pendingIsStart ? 'Iniciar' : 'Concluir';
  const confirmLoading = !!pendingAction && updatingTaskId === pendingAction.task.id;

  return (
    <>
      <TaskBoardFilters tasks={tasks} value={filters} onChange={setFilters} />

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {!hasResults ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-card py-12 text-sm text-muted-foreground">
          Nenhuma tarefa atende aos filtros selecionados.
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-4',
            visibleColumns.length === 1
              ? 'md:grid-cols-1'
              : visibleColumns.length === 2
                ? 'md:grid-cols-2'
                : visibleColumns.length === 3
                  ? 'md:grid-cols-2 xl:grid-cols-3'
                  : 'md:grid-cols-2 xl:grid-cols-4',
          )}
        >
          {visibleColumns.map((col) => {
            const items = grouped[col.status];
            return (
              <section
                key={col.status}
                className={cn('flex flex-col rounded-xl bg-muted/30 ring-1', col.ring)}
              >
                <header className="flex items-center gap-2 px-3 py-2.5">
                  <span className={cn('h-2.5 w-2.5 rounded-full', col.dot)} />
                  <h2 className="text-sm font-semibold">{TASK_STATUS_LABELS[col.status]}</h2>
                  <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {items.length}
                  </span>
                </header>
                <div className="flex flex-1 flex-col gap-2.5 px-2.5 pb-3">
                  {items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                      Sem tarefas
                    </p>
                  ) : (
                    items.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        updating={updatingTaskId === task.id}
                        admin={admin}
                        onOpen={setSelected}
                        onRequestStatusChange={handleRequestStatusChange}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <TaskDetailsModal
        task={selected}
        updating={selected ? updatingTaskId === selected.id : false}
        admin={admin}
        onClose={() => setSelected(null)}
        onRequestStatusChange={handleRequestStatusChange}
      />
      <ConfirmDialog
        open={!!pendingAction}
        title={confirmTitle}
        description={
          pendingAction ? (
            <span>
              <strong>{pendingAction.task.title}</strong>
              <br />
              {confirmDescription}
            </span>
          ) : null
        }
        confirmLabel={confirmLabel}
        loadingLabel="Salvando..."
        loading={confirmLoading}
        error={confirmError}
        onConfirm={handleConfirmStatusChange}
        onCancel={handleCancelStatusChange}
      />
    </>
  );
}
