import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, MapPin, Pencil, Play, Trash2 } from 'lucide-react';
import type { Task } from '../../types';
import { TaskPriorityBadge, TaskStatusBadge } from '../StatusBadge';
import { Modal } from '../Modal';
import { formatDateTime } from '../../lib/format';
import { getNextStatusAction, isOverdue, taskMapHref } from '../../lib/task';
import type { AdminActions, TaskStatusRequestHandler } from './types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function TaskDetailsModal({
  task,
  updating,
  admin,
  onClose,
  onRequestStatusChange,
}: {
  task: Task | null;
  updating: boolean;
  admin: AdminActions;
  onClose: () => void;
  onRequestStatusChange: TaskStatusRequestHandler;
}) {
  const navigate = useNavigate();
  const overdue = task ? isOverdue(task) : false;
  const action = task ? getNextStatusAction(task) : null;
  return (
    <Modal open={!!task} title={task?.title ?? ''} onClose={onClose}>
      {task && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3 w-3" />
                Atrasada
              </span>
            )}
          </div>

          {task.description && (
            <DetailRow label="Descrição">
              <p className="whitespace-pre-wrap text-foreground">{task.description}</p>
            </DetailRow>
          )}

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailRow label="Local">
              {task.trashBin ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {task.trashBin.code}
                  </span>
                  <span>{task.trashBin.name}</span>
                </span>
              ) : task.location ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>{task.location.name}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>

            <DetailRow label="Responsável">
              {task.assigneeName ?? <span className="text-muted-foreground">—</span>}
            </DetailRow>

            <DetailRow label="Prazo">
              <span className={cn(overdue && 'font-medium text-destructive')}>
                {task.dueDate ? formatDateTime(task.dueDate) : 'Sem prazo definido'}
              </span>
            </DetailRow>

            <DetailRow label="Criada em">{formatDateTime(task.createdAt)}</DetailRow>

            {task.startedAt && (
              <DetailRow label="Iniciada em">{formatDateTime(task.startedAt)}</DetailRow>
            )}

            {task.startedBy && <DetailRow label="Iniciada por">{task.startedBy.name}</DetailRow>}
          </dl>

          {(() => {
            const href = taskMapHref(task);
            if (!href && !action && !admin.canManage) return null;

            return (
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                {href && (
                  <Button type="button" variant="outline" onClick={() => navigate(href)}>
                    <MapPin className="h-4 w-4" />
                    Visualizar no mapa
                  </Button>
                )}
                {admin.canManage && (
                  <>
                    <Button type="button" variant="outline" onClick={() => admin.onEdit?.(task)}>
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => admin.onDelete?.(task)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      Excluir
                    </Button>
                  </>
                )}
                {action && (
                  <Button
                    type="button"
                    variant={action.status === 'done' ? 'default' : 'outline'}
                    disabled={updating}
                    onClick={() => onRequestStatusChange(task, action.status)}
                    className={cn(
                      action.status === 'in_progress' &&
                        'border-blue-500 bg-blue-500 text-white hover:bg-blue-600',
                    )}
                  >
                    {action.status === 'done' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {updating ? 'Salvando...' : action.label}
                  </Button>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </Modal>
  );
}
