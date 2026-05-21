import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TRASH_BIN_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
  type TrashBinStatus,
} from '../types';

type BinTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const BIN_TONE: Record<TrashBinStatus, BinTone> = {
  active: 'success',
  inactive: 'neutral',
  full: 'danger',
  maintenance: 'warning',
  offline: 'neutral',
};

const TASK_TONE: Record<TaskStatus, BinTone> = {
  pending: 'warning',
  in_progress: 'info',
  done: 'success',
  cancelled: 'neutral',
};

const PRIORITY_TONE: Record<TaskPriority, BinTone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
};

export function TrashBinStatusBadge({ status }: { status: TrashBinStatus }) {
  return (
    <span className={`badge badge--${BIN_TONE[status]}`}>
      {TRASH_BIN_STATUS_LABELS[status]}
    </span>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`badge badge--${TASK_TONE[status]}`}>
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`badge badge--${PRIORITY_TONE[priority]}`}>
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  );
}
