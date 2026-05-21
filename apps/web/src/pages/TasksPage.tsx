import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { CreateTaskInput, Task, TrashBin } from '../types';
import { ErrorState, LoadingState, EmptyState } from '../components/States';
import { TaskPriorityBadge, TaskStatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { TaskForm } from '../components/TaskForm';
import { formatDateTime } from '../lib/format';

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
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tarefas</h1>
          <p className="page-subtitle">Manutenção, coleta e ações operacionais</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>
          + Nova tarefa
        </button>
      </div>

      {error && <ErrorState message={error} />}
      {!tasks && !error && <LoadingState />}
      {tasks && tasks.length === 0 && <EmptyState label="Nenhuma tarefa criada ainda." />}

      {tasks && tasks.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Status</th>
                <th>Prioridade</th>
                <th>Lixeira</th>
                <th>Responsável</th>
                <th>Prazo</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{task.title}</div>
                    {task.description && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        {task.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <TaskStatusBadge status={task.status} />
                  </td>
                  <td>
                    <TaskPriorityBadge priority={task.priority} />
                  </td>
                  <td>
                    {task.trashBin ? (
                      <span className="mono">{task.trashBin.code}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{task.assigneeName ?? <span className="muted">—</span>}</td>
                  <td className="nowrap">{formatDateTime(task.dueDate)}</td>
                  <td>
                    <div className="table__actions">
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={() => openEdit(task)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => handleRemove(task)}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Editar tarefa' : 'Nova tarefa'}
        onClose={closeModal}
      >
        {formError && (
          <div className="state state--error" style={{ marginBottom: 12 }}>
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
    </>
  );
}
