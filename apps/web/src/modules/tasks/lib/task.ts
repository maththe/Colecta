import type { Task, TaskPriority, TaskStatus } from '@/types';

// Deep-link to the map focused on the task's origin.
// A câmera tem precedência: ocorrências de segurança devem focar o ponto exato
// da câmera (e não a posição/lixeira vinculada, que fica em outro lugar).
// Depois vem a lixeira (que já carrega sua própria posição) e a posição.
// Retorna null quando a tarefa não tem nenhum vínculo geográfico.
export function taskMapHref(task: Task): string | null {
  if (task.cameraId) return `/map?camera=${task.cameraId}`;
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

// Tarefas finalizadas (concluídas/canceladas) são históricas: o mais recente
// importa mais que a prioridade, então ordenamos pela data de conclusão.
function finishedAt(task: Task): number {
  const ref = task.completedAt ?? task.updatedAt;
  return ref ? new Date(ref).getTime() : 0;
}

export function sortTasksByRecency(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => finishedAt(b) - finishedAt(a));
}

// Colunas "ativas" usam ordenação por prioridade; as finalizadas, por recência.
export function sortTasksForStatus(status: TaskStatus, tasks: Task[]): Task[] {
  return status === 'done' || status === 'cancelled'
    ? sortTasksByRecency(tasks)
    : sortTasks(tasks);
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
