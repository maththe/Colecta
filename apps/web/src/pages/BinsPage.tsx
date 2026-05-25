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
import { useAuth } from '../contexts/AuthContext';
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

export function BinsPage() {
  const { user } = useAuth();
  const [bins, setBins] = useState<TrashBin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrashBin | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const canManageBins = user?.role === 'ADMIN';

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
    if (!canManageBins) return;
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(bin: TrashBin) {
    if (!canManageBins) return;
    setEditing(bin);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(values: CreateTrashBinInput) {
    if (!canManageBins) return;
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
    if (!canManageBins) return;
    if (!confirm(`Excluir a lixeira "${bin.name}"?`)) return;
    try {
      await api.trashBins.remove(bin.id);
      await load();
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Lixeiras</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro e monitoramento das lixeiras inteligentes
          </p>
        </div>
        {canManageBins && (
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Nova lixeira
          </Button>
        )}
      </div>

      {error && <ErrorState message={error} />}
      {!bins && !error && <LoadingState />}
      {bins && bins.length === 0 && <EmptyState label="Nenhuma lixeira cadastrada ainda." />}

      {bins && bins.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Preenchimento</TableHead>
                <TableHead>Bateria</TableHead>
                <TableHead>Última comunicação</TableHead>
                <TableHead>Localização</TableHead>
                {canManageBins && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {bins.map((bin) => (
                <TableRow key={bin.id}>
                  <TableCell>
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{bin.code}</span>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold">{bin.name}</div>
                    {bin.locationDescription && (
                      <div className="text-xs text-muted-foreground">{bin.locationDescription}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <TrashBinStatusBadge status={bin.status} />
                  </TableCell>
                  <TableCell>
                    <FillBar value={bin.fillLevel} />
                  </TableCell>
                  <TableCell>
                    <BatteryIndicator value={bin.batteryLevel} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatRelativeTime(bin.lastSeenAt)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatCoord(bin.latitude)}, {formatCoord(bin.longitude)}
                  </TableCell>
                  {canManageBins && (
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(bin)}>
                          Editar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleRemove(bin)}>
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

      {canManageBins && (
        <Modal
          open={modalOpen}
          title={editing ? 'Editar lixeira' : 'Nova lixeira'}
          onClose={closeModal}
        >
          {formError && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
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
      )}
    </div>
  );
}
