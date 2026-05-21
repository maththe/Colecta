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
      // On edit, sending null lets the backend clear the field; on create, undefined is omitted.
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
    <form className="form" onSubmit={submit} noValidate>
      <div className="form__field">
        <label className="form__label" htmlFor="task-title">
          Título
        </label>
        <input
          id="task-title"
          className="form__input"
          {...register('title', { required: 'Informe o título' })}
        />
        {errors.title && <span className="form__error">{errors.title.message}</span>}
      </div>

      <div className="form__field">
        <label className="form__label" htmlFor="task-desc">
          Descrição
        </label>
        <textarea
          id="task-desc"
          className="form__textarea"
          rows={3}
          {...register('description')}
        />
      </div>

      <div className="form__row">
        <div className="form__field">
          <label className="form__label" htmlFor="task-status">
            Status
          </label>
          <select id="task-status" className="form__select" {...register('status')}>
            {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="form__field">
          <label className="form__label" htmlFor="task-priority">
            Prioridade
          </label>
          <select
            id="task-priority"
            className="form__select"
            {...register('priority')}
          >
            {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form__field">
        <label className="form__label" htmlFor="task-bin">
          Lixeira relacionada
        </label>
        <select id="task-bin" className="form__select" {...register('trashBinId')}>
          <option value="">— Nenhuma —</option>
          {bins.map((bin) => (
            <option key={bin.id} value={bin.id}>
              {bin.code} — {bin.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form__row">
        <div className="form__field">
          <label className="form__label" htmlFor="task-assignee">
            Responsável
          </label>
          <input
            id="task-assignee"
            className="form__input"
            {...register('assigneeName')}
          />
        </div>
        <div className="form__field">
          <label className="form__label" htmlFor="task-due">
            Data limite
          </label>
          <input
            id="task-due"
            type="datetime-local"
            className="form__input"
            {...register('dueDate')}
          />
        </div>
      </div>

      <div className="form__actions">
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Salvando...' : initial ? 'Salvar' : 'Criar tarefa'}
        </button>
      </div>
    </form>
  );
}
