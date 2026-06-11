import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  MapPin,
  Pencil,
  Play,
  Trash2,
  Users,
} from 'lucide-react';
import type { Task, TaskStatus } from '../../types';
import { TaskPriorityBadge } from '../StatusBadge';
import { formatDateTime } from '../../lib/format';
import { getNextStatusAction, isOverdue } from '../../lib/task';
import type { AdminActions, TaskStatusRequestHandler } from './types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_ACCENT: Record<TaskStatus, string> = {
  pending: 'border-l-amber-500',
  in_progress: 'border-l-blue-500',
  done: 'border-l-primary',
  cancelled: 'border-l-muted-foreground/40',
};

export function TaskCard({
  task,
  updating,
  admin,
  onOpen,
  onRequestStatusChange,
}: {
  task: Task;
  updating: boolean;
  admin: AdminActions;
  onOpen: (task: Task) => void;
  onRequestStatusChange: TaskStatusRequestHandler;
}) {
  const overdue = isOverdue(task);
  const action = getNextStatusAction(task);
  const showFooter = !!action || !!admin.canManage;
  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-l-4 border-border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        STATUS_ACCENT[task.status],
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
      {showFooter && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-2">
          {admin.canManage && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => admin.onEdit?.(task)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => admin.onDelete?.(task)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                Excluir
              </Button>
            </>
          )}
          {action && (
            <Button
              type="button"
              size="sm"
              variant={action.status === 'done' ? 'default' : 'outline'}
              disabled={updating}
              onClick={() => onRequestStatusChange(task, action.status)}
              className={cn(
                action.status === 'in_progress' &&
                  'border-blue-500 bg-blue-500 text-white hover:bg-blue-600',
              )}
            >
              {action.status === 'done' ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {updating ? 'Salvando...' : action.label}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
