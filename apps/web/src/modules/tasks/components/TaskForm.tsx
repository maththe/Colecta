import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  EMPLOYEE_USER_ROLES,
  TASK_PRIORITY_LABELS,
  USER_ROLE_LABELS,
  type CreateTaskInput,
  type Location,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TrashBin,
  type User,
  type UserRole,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FilterChips } from '@/components/ui/filter-chips';
import { MapPin, Trash2 } from 'lucide-react';

// Tipo de vínculo da tarefa: uma lixeira, uma posição, ou nenhum. Substitui os
// dois selects que se desabilitavam mutuamente por uma escolha explícita.
type LinkType = 'bin' | 'location' | 'none';

// When the form is opened from the map for a specific marker, the link is
// already fixed by what the user clicked. The `target` describes that marker
// so the form can show it read-only and skip the bin/location dropdowns.
export type TaskFormTarget =
  | { kind: 'bin'; bin: TrashBin }
  | { kind: 'location'; location: Location }
  | { kind: 'point'; latitude: number; longitude: number };

interface Props {
  initial?: Task | null;
  defaults?: Partial<CreateTaskInput>;
  bins: TrashBin[];
  locations?: Location[];
  users: User[];
  /** Fixed bin/location when launched from a map marker. */
  target?: TaskFormTarget;
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
  locationId?: string;
  assigneeRole: UserRole | '';
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

export function TaskForm({
  initial,
  defaults,
  bins,
  locations = [],
  users,
  target,
  submitting,
  onCancel,
  onSubmit,
}: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: initial?.title ?? defaults?.title ?? '',
      description: initial?.description ?? defaults?.description ?? '',
      status: initial?.status ?? defaults?.status ?? 'pending',
      priority: initial?.priority ?? defaults?.priority ?? 'medium',
      trashBinId: initial?.trashBinId ?? defaults?.trashBinId ?? '',
      locationId:
        initial?.trashBinId || defaults?.trashBinId
          ? ''
          : initial?.locationId ?? defaults?.locationId ?? '',
      assigneeRole:
        target?.kind === 'bin'
          ? 'LIMPEZA'
          : initial?.assigneeRole ?? defaults?.assigneeRole ?? '',
      assigneeName: initial?.assigneeName ?? defaults?.assigneeName ?? '',
      dueDate: toLocalInput(initial?.dueDate ?? defaults?.dueDate),
    },
  });

  const selectedTrashBinId = watch('trashBinId');
  const selectedAssigneeRole = watch('assigneeRole');

  // Vínculo inicial derivado do que já vem preenchido (edição ou pré-seleção).
  const [linkType, setLinkType] = useState<LinkType>(
    initial?.trashBinId || defaults?.trashBinId
      ? 'bin'
      : initial?.locationId || defaults?.locationId
        ? 'location'
        : 'none',
  );

  const linkOptions: { value: LinkType; label: string }[] = [
    { value: 'bin', label: 'Lixeira' },
    ...(locations.length > 0 ? [{ value: 'location' as const, label: 'Posição' }] : []),
    { value: 'none', label: 'Nenhum' },
  ];

  // Ao trocar o tipo de vínculo, limpamos o id do outro tipo para o payload
  // nunca carregar os dois ao mesmo tempo.
  function changeLinkType(next: LinkType) {
    setLinkType(next);
    if (next !== 'bin') setValue('trashBinId', '');
    if (next !== 'location') setValue('locationId', '');
  }
  // Tarefas vinculadas a uma lixeira são obrigatoriamente do time de limpeza.
  const binLinked = target?.kind === 'bin' || !!selectedTrashBinId;
  const eligibleUsers = selectedAssigneeRole
    ? users.filter((user) => user.role === selectedAssigneeRole)
    : users.filter((user) => user.role !== 'ADMIN');
  const isEditing = Boolean(initial);
  const submit = handleSubmit((values) => {
    // Garante a regra mesmo que o campo travado seja burlado no cliente.
    const assigneeRole = binLinked ? 'LIMPEZA' : values.assigneeRole;
    if (!assigneeRole) return;
    const trimmedDesc = values.description?.trim() ?? '';
    const trimmedAssignee = values.assigneeName?.trim() ?? '';
    // When the form is bound to a map marker, the link is fixed by `target`
    // and the dropdowns are hidden — derive the ids from it directly so the
    // payload is correct regardless of any unrendered field state.
    const link = target
      ? target.kind === 'bin'
        ? { trashBinId: target.bin.id, locationId: null, latitude: null, longitude: null }
        : target.kind === 'location'
          ? { trashBinId: null, locationId: target.location.id, latitude: null, longitude: null }
          : {
              trashBinId: null,
              locationId: null,
              latitude: target.latitude,
              longitude: target.longitude,
            }
      : {
          trashBinId: values.trashBinId ? values.trashBinId : null,
          locationId: values.locationId ? values.locationId : null,
          latitude: null,
          longitude: null,
        };
    const payload: CreateTaskInput = {
      title: values.title.trim(),
      description: trimmedDesc ? trimmedDesc : isEditing ? null : undefined,
      status: values.status,
      priority: values.priority,
      trashBinId: link.trashBinId,
      locationId: link.locationId,
      latitude: link.latitude,
      longitude: link.longitude,
      assigneeRole,
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

      {target ? (
        <div className="flex flex-col gap-1.5">
          <Label>
            {target.kind === 'bin'
              ? 'Lixeira'
              : target.kind === 'location'
                ? 'Posição'
                : 'Local no mapa'}
          </Label>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/40 px-2.5 py-2 text-sm">
            {target.kind === 'bin' ? (
              <>
                <Trash2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                  {target.bin.code}
                </span>
                <span className="text-muted-foreground">{target.bin.name}</span>
              </>
            ) : target.kind === 'location' ? (
              <>
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span>{target.location.name}</span>
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-mono text-xs">
                  {target.latitude.toFixed(5)}, {target.longitude.toFixed(5)}
                </span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label>Vínculo</Label>
          <FilterChips options={linkOptions} value={linkType} onChange={changeLinkType} />

          {linkType === 'bin' && (
            <select
              id="task-bin"
              aria-label="Lixeira relacionada"
              className={`${selectClass} mt-1`}
              {...register('trashBinId', {
                onChange: (event) => {
                  if ((event.target as HTMLSelectElement).value) {
                    // Lixeira sempre vai para o time de limpeza.
                    setValue('assigneeRole', 'LIMPEZA');
                    setValue('assigneeName', '');
                  }
                },
              })}
            >
              <option value="">— Selecione a lixeira —</option>
              {bins.map((bin) => (
                <option key={bin.id} value={bin.id}>
                  {bin.code} — {bin.name}
                </option>
              ))}
            </select>
          )}

          {linkType === 'location' && (
            <select
              id="task-location"
              aria-label="Posição relacionada"
              className={`${selectClass} mt-1`}
              {...register('locationId')}
            >
              <option value="">— Selecione a posição —</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-assignee-role">Tipo de funcionário</Label>
          <select
            id="task-assignee-role"
            className={selectClass}
            aria-invalid={!!errors.assigneeRole}
            disabled={binLinked}
            {...register('assigneeRole', {
              required: 'Selecione o tipo de funcionário',
              onChange: () => setValue('assigneeName', ''),
            })}
          >
            <option value="">Selecione</option>
            {EMPLOYEE_USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {USER_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          {binLinked ? (
            <p className="text-xs text-muted-foreground">
              Tarefas de lixeira são sempre do time de limpeza.
            </p>
          ) : (
            errors.assigneeRole && (
              <p className="text-xs text-destructive">{errors.assigneeRole.message}</p>
            )
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-assignee">Responsável</Label>
          <select id="task-assignee" className={selectClass} {...register('assigneeName')}>
            <option value="">Sem responsável</option>
            {eligibleUsers.map((user) => (
              <option key={user.id} value={user.name}>
                {user.name} — {USER_ROLE_LABELS[user.role]}
              </option>
            ))}
          </select>
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
