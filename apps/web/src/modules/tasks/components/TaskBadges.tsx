import { Badge } from '@/components/ui/badge';
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from '@/types';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

const TASK_VARIANT: Record<TaskStatus, BadgeVariant> = {
  pending: 'outline',
  in_progress: 'info',
  done: 'success',
  cancelled: 'secondary',
};

const PRIORITY_VARIANT: Record<TaskPriority, BadgeVariant> = {
  low: 'secondary',
  medium: 'info',
  high: 'warning',
  urgent: 'destructive',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant={TASK_VARIANT[status]}>
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority]}>
      {TASK_PRIORITY_LABELS[priority]}
    </Badge>
  );
}
