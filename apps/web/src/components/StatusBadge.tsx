import { Badge } from '@/components/ui/badge';
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TRASH_BIN_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
  type TrashBinStatus,
} from '../types';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

const BIN_VARIANT: Record<TrashBinStatus, BadgeVariant> = {
  active: 'success',
  inactive: 'secondary',
  full: 'destructive',
  maintenance: 'warning',
  offline: 'secondary',
};

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

export function TrashBinStatusBadge({ status }: { status: TrashBinStatus }) {
  return (
    <Badge variant={BIN_VARIANT[status]}>
      {TRASH_BIN_STATUS_LABELS[status]}
    </Badge>
  );
}

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
