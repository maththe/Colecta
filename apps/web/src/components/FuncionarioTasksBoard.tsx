import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, MapPin, Users, AlertTriangle, Play, CheckCircle2 } from 'lucide-react';
import type { Task, TaskPriority, TaskStatus } from '../types';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '../types';
import { TaskPriorityBadge, TaskStatusBadge } from './StatusBadge';
import { formatDateTime } from '../lib/format';
import { taskMapHref } from '../lib/task';
import { Modal } from './Modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COLUMNS: { status: TaskStatus; dot: string; ring: string }[] = [
  { status: 'pending', dot: 'bg-amber-500', ring: 'ring-amber-500/20' },
  { status: 'in_progress', dot: 'bg-blue-500', ring: 'ring-blue-500/20' },
  { status: 'done', dot: 'bg-primary', ring: 'ring-primary/20' },
  { status: 'cancelled', dot: 'bg-muted-foreground', ring: 'ring-foreground/10' },
];

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_ACCENT: Record<TaskPriority, string> = {
  urgent: 'border-l-destructive',
  high: 'border-l-amber-500',
  medium: 'border-l-blue-500',
  low: 'border-l-muted-foreground/40',
};

type StatusFilter = TaskStatus | 'all';
type PriorityFilter = TaskPriority | 'all';
type DateFilter = 'all' | 'overdue' | 'today' | 'week' | 'no_date';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'done', label: 'Concluída' },
  { value: 'cancelled', label: 'Cancelada' },
];

const PRIORITY_FILTERS: { value: PriorityFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'urgent', label: TASK_PRIORITY_LABELS.urgent },
  { value: 'high', label: TASK_PRIORITY_LABELS.high },
  { value: 'medium', label: TASK_PRIORITY_LABELS.medium },
  { value: 'low', label: TASK_PRIORITY_LABELS.low },
];

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'overdue', label: 'Atrasadas' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Próximos 7 dias' },
  { value: 'no_date', label: 'Sem prazo' },
];

const ALL_ASSIGNEES = '__all__';
const UNASSIGNED = '__unassigned__';

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

type TaskStatusChangeHandler = (task: Task, status: TaskStatus) => Promise<Task>;

function getNextStatusAction(task: Task): { status: TaskStatus; label: string } | null {
  if (task.status === 'pending') return { status: 'in_progress', label: 'Iniciar' };
  if (task.status === 'in_progress') return { status: 'done', label: 'Concluir' };
  return null;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function matchesDateFilter(task: Task, filter: DateFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'no_date') return !task.dueDate;
  if (!task.dueDate) return false;
  const due = new Date(task.dueDate);
  const now = new Date();
  if (filter === 'overdue') {
    if (task.status === 'done' || task.status === 'cancelled') return false;
    return due.getTime() < now.getTime();
  }
  if (filter === 'today') {
    return startOfDay(due).getTime() === startOfDay(now).getTime();
  }
  if (filter === 'week') {
    const weekLater = new Date(now);
    weekLater.setDate(now.getDate() + 7);
    return due.getTime() >= now.getTime() && due.getTime() <= weekLater.getTime();
  }
  return true;
}

function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  if (task.status === 'done' || task.status === 'cancelled') return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return ad - bd;
  });
}

function TaskCard({
  task,
  updating,
  onOpen,
  onStatusChange,
}: {
  task: Task;
  updating: boolean;
  onOpen: (task: Task) => void;
  onStatusChange: TaskStatusChangeHandler;
}) {
  const overdue = isOverdue(task);
  const action = getNextStatusAction(task);
  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-l-4 border-border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        PRIORITY_ACCENT[task.priority],
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="flex w-full flex-col gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug">{task.title}</h3>
        <TaskPriorityBadge priority={task.priority} />
      </div>

      {task.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
      )}

      <div className="mt-1 flex flex-col gap-1.5 text-xs text-muted-foreground">
        {task.trashBin ? (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="font-mono text-[11px]">{task.trashBin.code}</span>
            <span className="truncate">{task.trashBin.name}</span>
          </span>
        ) : task.location ? (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{task.location.name}</span>
          </span>
        ) : null}
        {task.assigneeName && (
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{task.assigneeName}</span>
          </span>
        )}
        <span className={cn('flex items-center gap-1.5', overdue && 'font-medium text-destructive')}>
          {overdue ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          )}
          {task.dueDate ? formatDateTime(task.dueDate) : 'Sem prazo'}
          {overdue && <span className="ml-1">· Atrasada</span>}
        </span>
      </div>
      </button>
      {action && (
        <div className="flex justify-end border-t border-border pt-2">
          <Button
            type="button"
            size="sm"
            variant={action.status === 'done' ? 'default' : 'outline'}
            disabled={updating}
            onClick={() => onStatusChange(task, action.status)}
          >
            {action.status === 'done' ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {updating ? 'Salvando...' : action.label}
          </Button>
        </div>
      )}
    </article>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function TaskDetailsModal({
  task,
  updating,
  onClose,
  onStatusChange,
}: {
  task: Task | null;
  updating: boolean;
  onClose: () => void;
  onStatusChange: TaskStatusChangeHandler;
}) {
  const navigate = useNavigate();
  const overdue = task ? isOverdue(task) : false;
  const action = task ? getNextStatusAction(task) : null;
  return (
    <Modal open={!!task} title={task?.title ?? ''} onClose={onClose}>
      {task && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3 w-3" />
                Atrasada
              </span>
            )}
          </div>

          {task.description && (
            <DetailRow label="Descrição">
              <p className="whitespace-pre-wrap text-foreground">{task.description}</p>
            </DetailRow>
          )}

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailRow label="Local">
              {task.trashBin ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {task.trashBin.code}
                  </span>
                  <span>{task.trashBin.name}</span>
                </span>
              ) : task.location ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>{task.location.name}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>

            <DetailRow label="Responsável">
              {task.assigneeName ?? <span className="text-muted-foreground">—</span>}
            </DetailRow>

            <DetailRow label="Prazo">
              <span className={cn(overdue && 'font-medium text-destructive')}>
                {task.dueDate ? formatDateTime(task.dueDate) : 'Sem prazo definido'}
              </span>
            </DetailRow>

            <DetailRow label="Criada em">{formatDateTime(task.createdAt)}</DetailRow>
          </dl>

          {(() => {
            const href = taskMapHref(task);
            if (!href && !action) return null;

            return (
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                {href && (
                  <Button type="button" variant="outline" onClick={() => navigate(href)}>
                    <MapPin className="h-4 w-4" />
                    Visualizar no mapa
                  </Button>
                )}
                {action && (
                  <Button
                    type="button"
                    variant={action.status === 'done' ? 'default' : 'outline'}
                    disabled={updating}
                    onClick={() => onStatusChange(task, action.status)}
                  >
                    {action.status === 'done' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {updating ? 'Salvando...' : action.label}
                  </Button>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </Modal>
  );
}

export function FuncionarioTasksBoard({
  tasks,
  onStatusChange,
}: {
  tasks: Task[];
  onStatusChange: TaskStatusChangeHandler;
}) {
  const [selected, setSelected] = useState<Task | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState(ALL_ASSIGNEES);

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    tasks.forEach((task) => {
      if (task.assigneeName) names.add(task.assigneeName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [tasks]);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const matchesDate = matchesDateFilter(task, dateFilter);
        const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
        const matchesAssignee =
          assigneeFilter === ALL_ASSIGNEES ||
          (assigneeFilter === UNASSIGNED
            ? !task.assigneeName
            : task.assigneeName === assigneeFilter);

        return matchesDate && matchesPriority && matchesAssignee;
      }),
    [assigneeFilter, dateFilter, priorityFilter, tasks],
  );

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      pending: [],
      in_progress: [],
      done: [],
      cancelled: [],
    };
    for (const task of filteredTasks) map[task.status]?.push(task);
    for (const status of Object.keys(map) as TaskStatus[]) {
      map[status] = sortTasks(map[status]);
    }
    return map;
  }, [filteredTasks]);

  const visibleColumns =
    statusFilter === 'all' ? COLUMNS : COLUMNS.filter((c) => c.status === statusFilter);
  const visibleTaskCount = visibleColumns.reduce((sum, col) => sum + grouped[col.status].length, 0);
  const hasResults = visibleTaskCount > 0;
  const filtersActive =
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    dateFilter !== 'all' ||
    assigneeFilter !== ALL_ASSIGNEES;

  async function handleStatusChange(task: Task, status: TaskStatus): Promise<Task> {
    setUpdatingTaskId(task.id);
    setActionError(null);
    try {
      const updated = await onStatusChange(task, status);
      setSelected((current) => (current?.id === task.id ? updated : current));
      return updated;
    } catch {
      setActionError('Nao foi possivel atualizar o status da tarefa.');
      return task;
    } finally {
      setUpdatingTaskId(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </span>
          <FilterChips options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Prioridade
          </span>
          <FilterChips
            options={PRIORITY_FILTERS}
            value={priorityFilter}
            onChange={setPriorityFilter}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Prazo
          </span>
          <FilterChips options={DATE_FILTERS} value={dateFilter} onChange={setDateFilter} />
        </div>
        <div className="flex min-w-44 flex-col gap-1.5">
          <label
            htmlFor="task-board-assignee-filter"
            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Responsável
          </label>
          <select
            id="task-board-assignee-filter"
            className={selectClass}
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
          >
            <option value={ALL_ASSIGNEES}>Todos</option>
            <option value={UNASSIGNED}>Sem responsável</option>
            {assigneeOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setPriorityFilter('all');
              setDateFilter('all');
              setAssigneeFilter(ALL_ASSIGNEES);
            }}
            className="self-start text-xs font-medium text-primary hover:underline lg:ml-auto lg:self-center"
          >
            Limpar filtros
          </button>
        )}
      </div>

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
                        onOpen={setSelected}
                        onStatusChange={handleStatusChange}
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
        onClose={() => setSelected(null)}
        onStatusChange={handleStatusChange}
      />
    </>
  );
}
