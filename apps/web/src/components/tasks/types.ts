import type { Task, TaskStatus } from '../../types';

export type TaskStatusChangeHandler = (task: Task, status: TaskStatus) => Promise<Task>;
export type TaskStatusRequestHandler = (task: Task, status: TaskStatus) => void;

// Ações de gestão disponíveis apenas na visão de admin (criar/editar/excluir).
export interface AdminActions {
  canManage?: boolean;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}
