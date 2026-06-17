import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import {
  type CreateTaskInput,
  type Location,
  type Task,
  type TaskStatus,
  type TrashBin,
  type User,
} from '@/types';
import { ErrorState, LoadingState, EmptyState } from '@/components/States';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TaskForm, TasksBoard } from '@/modules/tasks/components';
import { StatCard } from '@/components/StatCard';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, ListTodo, Loader, Plus } from 'lucide-react';

interface TasksPageData {
  tasks: Task[];
  bins: TrashBin[];
  locations: Location[];
  users: User[];
}

export function TasksPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusTaskId = searchParams.get('task');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const canManageTasks = user?.role === 'ADMIN';

  // Admin também carrega lixeiras/posições/usuários para preencher o formulário.
  const fetchData = useCallback(async (): Promise<TasksPageData> => {
    if (canManageTasks) {
      const [tasks, bins, locations, users] = await Promise.all([
        api.tasks.list(),
        api.trashBins.list(),
        api.locations.list(),
        api.users.list(),
      ]);
      return { tasks, bins, locations, users };
    }
    return { tasks: await api.tasks.list(), bins: [], locations: [], users: [] };
  }, [canManageTasks]);

  const {
    data,
    setData,
    error,
    reload: load,
  } = useAsyncData(fetchData, 'Falha ao carregar tarefas');
  const tasks = data?.tasks ?? null;
  const bins = data?.bins ?? [];
  const locations = data?.locations ?? [];
  const users = data?.users ?? [];

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
    setData((current) =>
      current
        ? {
            ...current,
            tasks: current.tasks.map((item) => (item.id === updated.id ? updated : item)),
          }
        : current,
    );
    return updated;
  }

  const clearFocusTask = useCallback(() => {
    if (!focusTaskId) return;
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    setSearchParams(next, { replace: true });
  }, [focusTaskId, searchParams, setSearchParams]);

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
          <TasksBoard
            tasks={tasks}
            onStatusChange={handleStatusChange}
            currentUserName={user?.name ?? null}
            currentUserRole={user?.role ?? null}
            focusTaskId={focusTaskId}
            onFocusTaskConsumed={clearFocusTask}
          />
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
        <div className="flex flex-wrap gap-2">
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Nova tarefa
          </Button>
        </div>
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
            focusTaskId={focusTaskId}
            onFocusTaskConsumed={clearFocusTask}
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
