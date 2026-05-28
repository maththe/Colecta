import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type CreateTaskInput,
  type Location,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TrashBin,
  type User,
} from '../types';
import { taskMapHref } from '../lib/task';
import { ErrorState, LoadingState, EmptyState } from '../components/States';
import { TaskPriorityBadge, TaskStatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { TaskForm } from '../components/TaskForm';
import { FuncionarioTasksBoard } from '../components/FuncionarioTasksBoard';
import { formatDateTime } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MapPin, Plus } from 'lucide-react';

const TASK_STATUSES = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];
const TASK_PRIORITIES = Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[];
const ALL_FILTER = 'all';
const ALL_ASSIGNEES = '__all__';
const UNASSIGNED = '__unassigned__';

type StatusFilter = TaskStatus | typeof ALL_FILTER;
type PriorityFilter = TaskPriority | typeof ALL_FILTER;

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function TasksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [bins, setBins] = useState<TrashBin[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL_FILTER);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(ALL_FILTER);
  const [assigneeFilter, setAssigneeFilter] = useState(ALL_ASSIGNEES);
  const canManageTasks = user?.role === 'ADMIN';

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    users.forEach((u) => names.add(u.name));
    tasks?.forEach((task) => {
      if (task.assigneeName) names.add(task.assigneeName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [tasks, users]);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((task) => {
      const matchesStatus = statusFilter === ALL_FILTER || task.status === statusFilter;
      const matchesPriority = priorityFilter === ALL_FILTER || task.priority === priorityFilter;
      const matchesAssignee =
        assigneeFilter === ALL_ASSIGNEES ||
        (assigneeFilter === UNASSIGNED ? !task.assigneeName : task.assigneeName === assigneeFilter);

      return matchesStatus && matchesPriority && matchesAssignee;
    });
  }, [assigneeFilter, priorityFilter, statusFilter, tasks]);

  const filtersActive =
    statusFilter !== ALL_FILTER ||
    priorityFilter !== ALL_FILTER ||
    assigneeFilter !== ALL_ASSIGNEES;

  function clearFilters() {
    setStatusFilter(ALL_FILTER);
    setPriorityFilter(ALL_FILTER);
    setAssigneeFilter(ALL_ASSIGNEES);
  }

  async function load() {
    setError(null);
    try {
      if (canManageTasks) {
        const [t, b, l, u] = await Promise.all([
          api.tasks.list(),
          api.trashBins.list(),
          api.locations.list(),
          api.users.list(),
        ]);
        setTasks(t);
        setBins(b);
        setLocations(l);
        setUsers(u);
      } else {
        setTasks(await api.tasks.list());
      }
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar tarefas');
    }
  }

  useEffect(() => {
    load();
  }, [canManageTasks]);

  function openCreate() {
    if (!canManageTasks) return;
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    if (!canManageTasks) return;
    setEditing(task);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(values: CreateTaskInput) {
    if (!canManageTasks) return;
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) {
        await api.tasks.update(editing.id, values);
      } else {
        await api.tasks.create(values);
      }
      closeModal();
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao salvar tarefa');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(task: Task) {
    if (!canManageTasks) return;
    if (!confirm(`Excluir a tarefa "${task.title}"?`)) return;
    try {
      await api.tasks.remove(task.id);
      await load();
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : 'Erro ao excluir tarefa');
    }
  }

  async function handleFuncionarioStatusChange(task: Task, status: TaskStatus): Promise<Task> {
    const updated = await api.tasks.update(task.id, { status });
    setTasks((current) =>
      current ? current.map((item) => (item.id === updated.id ? updated : item)) : current,
    );
    return updated;
  }

  if (!canManageTasks) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">Quadro de Tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe as operações de campo organizadas por andamento
          </p>
        </div>

        {error && <ErrorState message={error} />}
        {!tasks && !error && <LoadingState />}
        {tasks && tasks.length === 0 && <EmptyState label="Nenhuma tarefa atribuída ainda." />}
        {tasks && tasks.length > 0 && (
          <FuncionarioTasksBoard tasks={tasks} onStatusChange={handleFuncionarioStatusChange} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manutenção, coleta e ações operacionais
          </p>
        </div>
        {canManageTasks && (
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Nova tarefa
          </Button>
        )}
      </div>

      {error && <ErrorState message={error} />}
      {!tasks && !error && <LoadingState />}
      {tasks && tasks.length === 0 && <EmptyState label="Nenhuma tarefa criada ainda." />}

      {tasks && tasks.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total', value: filteredTasks.length, accent: 'text-foreground' },
            {
              label: 'Pendentes',
              value: filteredTasks.filter((t) => t.status === 'pending').length,
              accent: 'text-amber-500',
            },
            {
              label: 'Em andamento',
              value: filteredTasks.filter((t) => t.status === 'in_progress').length,
              accent: 'text-blue-500',
            },
            {
              label: 'Concluídas',
              value: filteredTasks.filter((t) => t.status === 'done').length,
              accent: 'text-primary',
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
              <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {tasks && tasks.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-status-filter">Status</Label>
              <select
                id="task-status-filter"
                className={selectClass}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <option value={ALL_FILTER}>Todos</option>
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {TASK_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-priority-filter">Prioridade</Label>
              <select
                id="task-priority-filter"
                className={selectClass}
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
              >
                <option value={ALL_FILTER}>Todas</option>
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {TASK_PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-assignee-filter">Responsável</Label>
              <select
                id="task-assignee-filter"
                className={selectClass}
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
              >
                <option value={ALL_ASSIGNEES}>Todos</option>
                <option value={UNASSIGNED}>Sem responsável</option>
                {assigneeOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
              <span className="text-xs text-muted-foreground">
                {filteredTasks.length} de {tasks.length} tarefas
              </span>
              {filtersActive && (
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {tasks && tasks.length > 0 && filteredTasks.length === 0 && (
        <EmptyState label="Nenhuma tarefa atende aos filtros selecionados." />
      )}

      {filteredTasks.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prazo</TableHead>
                {canManageTasks && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="font-semibold">{task.title}</div>
                    {task.description && (
                      <div className="text-xs text-muted-foreground">{task.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <TaskStatusBadge status={task.status} />
                  </TableCell>
                  <TableCell>
                    <TaskPriorityBadge priority={task.priority} />
                  </TableCell>
                  <TableCell>
                    {task.trashBin ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          {task.trashBin.code}
                        </span>
                        <span className="text-xs text-muted-foreground">{task.trashBin.name}</span>
                      </span>
                    ) : task.location ? (
                      <span className="inline-flex items-center gap-1 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {task.location.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{task.assigneeName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm">{formatDateTime(task.dueDate)}</TableCell>
                  {canManageTasks && (
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {(() => {
                          const href = taskMapHref(task);
                          return href ? (
                            <Button variant="outline" size="sm" onClick={() => navigate(href)}>
                              <MapPin className="h-4 w-4" />
                              Mapa
                            </Button>
                          ) : null;
                        })()}
                        <Button variant="outline" size="sm" onClick={() => openEdit(task)}>
                          Editar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleRemove(task)}>
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {canManageTasks && (
        <Modal
          open={modalOpen}
          title={editing ? 'Editar tarefa' : 'Nova tarefa'}
          onClose={closeModal}
        >
          {formError && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          <TaskForm
            initial={editing}
            bins={bins}
            locations={locations}
            users={users}
            submitting={submitting}
            onCancel={closeModal}
            onSubmit={handleSubmit}
          />
        </Modal>
      )}
    </div>
  );
}
