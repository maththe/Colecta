import { useMemo } from 'react';
import type { Task, TaskPriority, TaskStatus } from '../../types';
import { TASK_PRIORITY_LABELS } from '../../types';
import { matchesDateFilter, type TaskDateFilter } from '../../lib/task';
import { FilterChips } from '@/components/ui/filter-chips';

export type StatusFilter = TaskStatus | 'all';
export type PriorityFilter = TaskPriority | 'all';

export interface TaskBoardFilterState {
  status: StatusFilter;
  priority: PriorityFilter;
  date: TaskDateFilter;
  assignee: string;
}

export const ALL_ASSIGNEES = '__all__';
export const UNASSIGNED = '__unassigned__';

export const DEFAULT_TASK_FILTERS: TaskBoardFilterState = {
  status: 'all',
  priority: 'all',
  date: 'all',
  assignee: ALL_ASSIGNEES,
};

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

const DATE_FILTERS: { value: TaskDateFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'overdue', label: 'Atrasadas' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Próximos 7 dias' },
  { value: 'no_date', label: 'Sem prazo' },
];

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

// O filtro de status define quais colunas ficam visíveis no quadro;
// os demais (prazo, prioridade, responsável) filtram os cartões.
export function taskMatchesFilters(task: Task, filters: TaskBoardFilterState): boolean {
  const matchesDate = matchesDateFilter(task, filters.date);
  const matchesPriority = filters.priority === 'all' || task.priority === filters.priority;
  const matchesAssignee =
    filters.assignee === ALL_ASSIGNEES ||
    (filters.assignee === UNASSIGNED
      ? !task.assigneeName
      : task.assigneeName === filters.assignee);

  return matchesDate && matchesPriority && matchesAssignee;
}

export function TaskBoardFilters({
  tasks,
  value,
  onChange,
}: {
  tasks: Task[];
  value: TaskBoardFilterState;
  onChange: (value: TaskBoardFilterState) => void;
}) {
  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    tasks.forEach((task) => {
      if (task.assigneeName) names.add(task.assigneeName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [tasks]);

  const filtersActive =
    value.status !== 'all' ||
    value.priority !== 'all' ||
    value.date !== 'all' ||
    value.assignee !== ALL_ASSIGNEES;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-3 flex flex-col gap-1.5 sm:w-56">
        <label
          htmlFor="task-board-assignee-filter"
          className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Responsável
        </label>
        <select
          id="task-board-assignee-filter"
          className={selectClass}
          value={value.assignee}
          onChange={(event) => onChange({ ...value, assignee: event.target.value })}
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </span>
          <FilterChips
            options={STATUS_FILTERS}
            value={value.status}
            onChange={(status) => onChange({ ...value, status })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Prioridade
          </span>
          <FilterChips
            options={PRIORITY_FILTERS}
            value={value.priority}
            onChange={(priority) => onChange({ ...value, priority })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Prazo
          </span>
          <FilterChips
            options={DATE_FILTERS}
            value={value.date}
            onChange={(date) => onChange({ ...value, date })}
          />
        </div>
      </div>

      {filtersActive && (
        <button
          type="button"
          onClick={() => onChange(DEFAULT_TASK_FILTERS)}
          className="self-start text-xs font-medium text-primary hover:underline lg:ml-auto lg:self-center"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
