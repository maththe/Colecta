export type NotificationKind =
  | 'task_assigned'
  | 'task_urgent'
  | 'task_overdue'
  | 'task_done'
  | 'task_auto';

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  taskId: string | null;
  readAt: string | null;
  createdAt: string;
}
