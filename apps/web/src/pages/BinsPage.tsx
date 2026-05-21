import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { CreateTrashBinInput, TrashBin } from '../types';
import { ErrorState, LoadingState, EmptyState } from '../components/States';
import { TrashBinStatusBadge } from '../components/StatusBadge';
import { FillBar } from '../components/FillBar';
import { BatteryIndicator } from '../components/BatteryIndicator';
import { Modal } from '../components/Modal';
import { TrashBinForm } from '../components/TrashBinForm';
import { formatCoord, formatRelativeTime } from '../lib/format';

export function BinsPage() {
  const [bins, setBins] = useState<TrashBin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrashBin | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await api.trashBins.list();
      setBins(data);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar lixeiras');
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

  function openEdit(bin: TrashBin) {
    setEditing(bin);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(values: CreateTrashBinInput) {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) {
        await api.trashBins.update(editing.id, values);
      } else {
        await api.trashBins.create(values);
      }
      closeModal();
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao salvar lixeira');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(bin: TrashBin) {
    if (!confirm(`Excluir a lixeira "${bin.name}"?`)) return;
    try {
      await api.trashBins.remove(bin.id);
      await load();
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Lixeiras</h1>
          <p className="page-subtitle">Cadastro e monitoramento das lixeiras inteligentes</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>
          + Nova lixeira
        </button>
      </div>

      {error && <ErrorState message={error} />}
      {!bins && !error && <LoadingState />}
      {bins && bins.length === 0 && <EmptyState label="Nenhuma lixeira cadastrada ainda." />}

      {bins && bins.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Status</th>
                <th>Preenchimento</th>
                <th>Bateria</th>
                <th>Última comunicação</th>
                <th>Localização</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {bins.map((bin) => (
                <tr key={bin.id}>
                  <td>
                    <span className="mono">{bin.code}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{bin.name}</div>
                    {bin.locationDescription && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        {bin.locationDescription}
                      </div>
                    )}
                  </td>
                  <td>
                    <TrashBinStatusBadge status={bin.status} />
                  </td>
                  <td>
                    <FillBar value={bin.fillLevel} />
                  </td>
                  <td>
                    <BatteryIndicator value={bin.batteryLevel} />
                  </td>
                  <td className="nowrap muted">{formatRelativeTime(bin.lastSeenAt)}</td>
                  <td className="nowrap mono">
                    {formatCoord(bin.latitude)}, {formatCoord(bin.longitude)}
                  </td>
                  <td>
                    <div className="table__actions">
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={() => openEdit(bin)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => handleRemove(bin)}
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
        title={editing ? 'Editar lixeira' : 'Nova lixeira'}
        onClose={closeModal}
      >
        {formError && (
          <div className="state state--error" style={{ marginBottom: 12 }}>
            {formError}
          </div>
        )}
        <TrashBinForm
          initial={editing}
          submitting={submitting}
          onCancel={closeModal}
          onSubmit={handleSubmit}
        />
      </Modal>
    </>
  );
}
