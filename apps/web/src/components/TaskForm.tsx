import { useForm } from 'react-hook-form';
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type CreateTaskInput,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TrashBin,
} from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  initial?: Task | null;
  bins: TrashBin[];
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: CreateTaskInput) => void | Promise<void>;
}

type FormValues = {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  trashBinId?: string;
  assigneeName?: string;
  dueDate?: string;
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

export function TaskForm({ initial, bins, submitting, onCancel, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      status: initial?.status ?? 'pending',
      priority: initial?.priority ?? 'medium',
      trashBinId: initial?.trashBinId ?? '',
      assigneeName: initial?.assigneeName ?? '',
      dueDate: toLocalInput(initial?.dueDate),
    },
  });

  const isEditing = Boolean(initial);
  const submit = handleSubmit((values) => {
    const trimmedDesc = values.description?.trim() ?? '';
    const trimmedAssignee = values.assigneeName?.trim() ?? '';
    const payload: CreateTaskInput = {
      title: values.title.trim(),
      description: trimmedDesc ? trimmedDesc : isEditing ? null : undefined,
      status: values.status,
      priority: values.priority,
      trashBinId: values.trashBinId ? values.trashBinId : null,
      assigneeName: trimmedAssignee ? trimmedAssignee : isEditing ? null : undefined,
      dueDate: values.dueDate
        ? new Date(values.dueDate).toISOString()
        : isEditing
          ? null
          : undefined,
    };
    return onSubmit(payload);
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-title">Título</Label>
        <Input
          id="task-title"
          {...register('title', { required: 'Informe o título' })}
          aria-invalid={!!errors.title}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-desc">Descrição</Label>
        <Textarea id="task-desc" rows={3} {...register('description')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-status">Status</Label>
          <select id="task-status" className={selectClass} {...register('status')}>
            {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-priority">Prioridade</Label>
          <select id="task-priority" className={selectClass} {...register('priority')}>
            {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-bin">Lixeira relacionada</Label>
        <select id="task-bin" className={selectClass} {...register('trashBinId')}>
          <option value="">— Nenhuma —</option>
          {bins.map((bin) => (
            <option key={bin.id} value={bin.id}>
              {bin.code} — {bin.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-assignee">Responsável</Label>
          <Input id="task-assignee" {...register('assigneeName')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-due">Data limite</Label>
          <Input id="task-due" type="datetime-local" {...register('dueDate')} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : initial ? 'Salvar' : 'Criar tarefa'}
        </Button>
      </div>
    </form>
  );
}
