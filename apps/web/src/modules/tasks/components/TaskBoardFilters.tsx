import { useMemo } from 'react';
import type { Task, TaskPriority } from '@/types';
import { TASK_PRIORITY_LABELS } from '@/types';
import { matchesDateFilter, type TaskDateFilter } from '@/modules/tasks/lib/task';
import { FilterChips } from '@/components/ui/filter-chips';

export type PriorityFilter = TaskPriority | 'all';

export interface TaskBoardFilterState {
  priority: PriorityFilter;
  date: TaskDateFilter;
  assignee: string;
}

export const ALL_ASSIGNEES = '__all__';
export const UNASSIGNED = '__unassigned__';

export const DEFAULT_TASK_FILTERS: TaskBoardFilterState = {
  priority: 'all',
  date: 'all',
  assignee: ALL_ASSIGNEES,
};

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

// Os filtros (prazo, prioridade, responsável) refinam os cartões dentro de
// cada coluna; o conjunto de colunas em si é sempre o quadro completo.
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
  showAssigneeFilter = true,
}: {
  tasks: Task[];
  value: TaskBoardFilterState;
  onChange: (value: TaskBoardFilterState) => void;
  showAssigneeFilter?: boolean;
}) {
  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    tasks.forEach((task) => {
      if (task.assigneeName) names.add(task.assigneeName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [tasks]);

  const refineActive =
    value.priority !== 'all' ||
    value.date !== 'all' ||
    (showAssigneeFilter && value.assignee !== ALL_ASSIGNEES);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
        {showAssigneeFilter && (
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
        )}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
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

          {refineActive && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  priority: 'all',
                  date: 'all',
                  assignee: ALL_ASSIGNEES,
                })
              }
              className="self-start text-xs font-medium text-primary hover:underline lg:ml-auto lg:self-center"
            >
              Limpar filtros
            </button>
          )}
        </div>
    </div>
  );
}
