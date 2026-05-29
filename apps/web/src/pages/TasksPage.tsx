import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import {
  type CreateTaskInput,
  type Location,
  type Task,
  type TaskStatus,
  type TrashBin,
  type User,
} from '../types';
import { ErrorState, LoadingState, EmptyState } from '../components/States';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TaskForm } from '../components/TaskForm';
import { TasksBoard } from '../components/TasksBoard';
import { StatCard } from '../components/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, ListTodo, Loader, Plus } from 'lucide-react';

export function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [bins, setBins] = useState<TrashBin[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const canManageTasks = user?.role === 'ADMIN';

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

  function requestRemove(task: Task) {
    if (!canManageTasks) return;
    setDeleteError(null);
    setPendingDelete(task);
  }

  function cancelRemove() {
    setPendingDelete(null);
    setDeleteError(null);
  }

  async function confirmRemove() {
    if (!pendingDelete || !canManageTasks) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.tasks.remove(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch (err: unknown) {
      setDeleteError(err instanceof ApiError ? err.message : 'Erro ao excluir tarefa');
    } finally {
      setDeleting(false);
    }
  }

  async function handleStatusChange(task: Task, status: TaskStatus): Promise<Task> {
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
          <TasksBoard tasks={tasks} onStatusChange={handleStatusChange} />
        )}
      </div>
    );
  }

  const stats = tasks
    ? {
        total: tasks.length,
        pending: tasks.filter((t) => t.status === 'pending').length,
        inProgress: tasks.filter((t) => t.status === 'in_progress').length,
        done: tasks.filter((t) => t.status === 'done').length,
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manutenção, coleta e ações operacionais
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      {error && <ErrorState message={error} />}
      {!tasks && !error && <LoadingState />}
      {tasks && tasks.length === 0 && <EmptyState label="Nenhuma tarefa criada ainda." />}

      {tasks && stats && tasks.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total" value={stats.total} Icon={ListTodo} tone="primary" />
            <StatCard label="Pendentes" value={stats.pending} Icon={Clock} tone="warning" />
            <StatCard label="Em andamento" value={stats.inProgress} Icon={Loader} tone="info" />
            <StatCard label="Concluídas" value={stats.done} Icon={CheckCircle2} tone="primary" />
          </div>

          <TasksBoard
            tasks={tasks}
            onStatusChange={handleStatusChange}
            canManage
            onEdit={openEdit}
            onDelete={requestRemove}
          />
        </>
      )}

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

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir tarefa"
        description={
          pendingDelete && (
            <>
              A tarefa <strong>{pendingDelete.title}</strong> será removida permanentemente. Esta
              ação não pode ser desfeita.
            </>
          )
        }
        confirmLabel="Excluir"
        destructive
        loading={deleting}
        error={deleteError}
        onConfirm={() => void confirmRemove()}
        onCancel={cancelRemove}
      />
    </div>
  );
}
