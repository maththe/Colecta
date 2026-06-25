import { useEffect, useMemo, useState } from 'react';
import type { Task, TaskStatus, UserRole } from '@/types';
import { TASK_STATUS_LABELS } from '@/types';
import { sortTasksForStatus } from '@/modules/tasks/lib/task';
import { ApiError } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FilterChips } from '@/components/ui/filter-chips';
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

// Cada coluna mostra só as primeiras tarefas e libera o restante sob demanda,
// evitando que o quadro cresça sem limite.
const COLUMN_VISIBLE_LIMIT = 8;

type Scope = 'mine' | 'all';

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
  currentUserName,
  currentUserRole,
  focusTaskId,
  onFocusTaskConsumed,
  canManage,
  onEdit,
  onDelete,
}: {
  tasks: Task[];
  onStatusChange: TaskStatusChangeHandler;
  // Quando informado (funcionário), habilita o filtro "Minhas / Todas".
  currentUserName?: string | null;
  currentUserRole?: UserRole | null;
  focusTaskId?: string | null;
  onFocusTaskConsumed?: () => void;
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
  const canScope = !!currentUserName || !!currentUserRole;
  const [scope, setScope] = useState<Scope>(canScope ? 'mine' : 'all');
  const [expanded, setExpanded] = useState<Partial<Record<TaskStatus, boolean>>>({});

  useEffect(() => {
    if (!focusTaskId) return;
    const task = tasks.find((item) => item.id === focusTaskId);
    if (!task) return;
    setSelected(task);
    onFocusTaskConsumed?.();
  }, [focusTaskId, onFocusTaskConsumed, tasks]);

  // O servidor já entrega apenas as tarefas do time do funcionário. Aqui o
  // escopo "Minhas" estreita para as atribuídas nominalmente a ele; "Do meu
  // time" mostra todas as recebidas (o time inteiro). Sem nome para filtrar,
  // "Minhas" cai para o papel para não ficar vazio à toa.
  const scopedTasks = useMemo(
    () =>
      canScope && scope === 'mine'
        ? tasks.filter((task) =>
            currentUserName
              ? task.assigneeName === currentUserName
              : currentUserRole
                ? task.assigneeRole === currentUserRole
                : true,
          )
        : tasks,
    [canScope, scope, tasks, currentUserName, currentUserRole],
  );

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      pending: [],
      in_progress: [],
      done: [],
      cancelled: [],
    };
    for (const task of scopedTasks) {
      if (taskMatchesFilters(task, filters)) map[task.status]?.push(task);
    }
    for (const status of Object.keys(map) as TaskStatus[]) {
      map[status] = sortTasksForStatus(status, map[status]);
    }
    return map;
  }, [filters, scopedTasks]);

  const visibleTaskCount = COLUMNS.reduce((sum, col) => sum + grouped[col.status].length, 0);
  const hasResults = visibleTaskCount > 0;

  async function handleStatusChange(task: Task, status: TaskStatus): Promise<Task> {
    setUpdatingTaskId(task.id);
    setActionError(null);
    try {
      const updated = await onStatusChange(task, status);
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
      // Fecha o detalhe após a ação para não reabrir o próximo passo
      // (iniciar não deve "virar" um modal de concluir, e vice-versa).
      setSelected(null);
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
      {canScope && (
        <FilterChips
          options={[
            { value: 'mine', label: 'Minhas' },
            { value: 'all', label: 'Do meu time' },
          ]}
          value={scope}
          onChange={(next) => setScope(next as Scope)}
        />
      )}

      <TaskBoardFilters
        tasks={scopedTasks}
        value={filters}
        onChange={setFilters}
        showAssigneeFilter={!canScope || scope === 'all'}
      />

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {!hasResults ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-card py-12 text-sm text-muted-foreground">
          {scope === 'mine'
            ? 'Você não tem tarefas que atendam aos filtros selecionados.'
            : 'Nenhuma tarefa atende aos filtros selecionados.'}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = grouped[col.status];
            const capped = !expanded[col.status];
            const shown = capped ? items.slice(0, COLUMN_VISIBLE_LIMIT) : items;
            const hidden = items.length - shown.length;
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
                    <>
                      {shown.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          updating={updatingTaskId === task.id}
                          admin={admin}
                          onOpen={setSelected}
                          onRequestStatusChange={handleRequestStatusChange}
                        />
                      ))}
                      {hidden > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpanded((prev) => ({ ...prev, [col.status]: true }))}
                          className="rounded-lg border border-dashed border-border py-2 text-center text-xs font-medium text-primary hover:bg-muted"
                        >
                          Ver mais {hidden} {hidden === 1 ? 'tarefa' : 'tarefas'}
                        </button>
                      )}
                    </>
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
