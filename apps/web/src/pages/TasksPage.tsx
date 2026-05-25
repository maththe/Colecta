import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { CreateTaskInput, Task, TrashBin } from '../types';
import { ErrorState, LoadingState, EmptyState } from '../components/States';
import { TaskPriorityBadge, TaskStatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { TaskForm } from '../components/TaskForm';
import { formatDateTime } from '../lib/format';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus } from 'lucide-react';

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [bins, setBins] = useState<TrashBin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [t, b] = await Promise.all([api.tasks.list(), api.trashBins.list()]);
      setTasks(t);
      setBins(b);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar tarefas');
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(values: CreateTaskInput) {
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
    if (!confirm(`Excluir a tarefa "${task.title}"?`)) return;
    try {
      await api.tasks.remove(task.id);
      await load();
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : 'Erro ao excluir tarefa');
    }
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
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      {error && <ErrorState message={error} />}
      {!tasks && !error && <LoadingState />}
      {tasks && tasks.length === 0 && <EmptyState label="Nenhuma tarefa criada ainda." />}

      {tasks && tasks.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Lixeira</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
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
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {task.trashBin.code}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{task.assigneeName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm">{formatDateTime(task.dueDate)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(task)}>
                        Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleRemove(task)}>
                        Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
          submitting={submitting}
          onCancel={closeModal}
          onSubmit={handleSubmit}
        />
      </Modal>
    </div>
  );
}
