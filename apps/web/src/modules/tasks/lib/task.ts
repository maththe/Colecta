import type { Task, TaskPriority, TaskStatus } from '../types';

// Deep-link to the map focused on the task's bin or position.
// Bins take precedence (a bin already carries its own location);
// returns null when the task has neither.
export function taskMapHref(task: Task): string | null {
  if (task.trashBin) return `/map?bin=${task.trashBin.id}`;
  if (task.location) return `/map?location=${task.location.id}`;
  return null;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// Próxima transição válida no fluxo pending → in_progress → done.
export function getNextStatusAction(
  task: Task,
): { status: TaskStatus; label: string } | null {
  if (task.status === 'pending') return { status: 'in_progress', label: 'Iniciar' };
  if (task.status === 'in_progress') return { status: 'done', label: 'Concluir' };
  return null;
}

export function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  if (task.status === 'done' || task.status === 'cancelled') return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

// Prioridade mais alta primeiro; empate decidido pelo prazo mais próximo.
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return ad - bd;
  });
}

export type TaskDateFilter = 'all' | 'overdue' | 'today' | 'week' | 'no_date';

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function matchesDateFilter(task: Task, filter: TaskDateFilter): boolean {
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
