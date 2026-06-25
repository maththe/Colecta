import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BatteryLow,
  Gauge,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { CreateTrashBinInput, TrashBin, TrashBinStatus } from '@/types';
import { TRASH_BIN_STATUS_LABELS } from '@/types';
import { ErrorState, EmptyState } from '@/components/States';
import { TrashBinStatusBadge } from '../components/TrashBinStatusBadge';
import { FillBar } from '../components/FillBar';
import { BatteryIndicator } from '../components/BatteryIndicator';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TrashBinForm } from '../components/TrashBinForm';
import { formatCoord, formatRelativeTime } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { FilterChips } from '@/components/ui/filter-chips';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Order from most to least critical — drives the default sort.
const STATUS_PRIORITY: Record<TrashBinStatus, number> = {
  full: 0,
  offline: 1,
  maintenance: 2,
  inactive: 3,
  active: 4,
};

type StatusFilter = 'all' | TrashBinStatus;

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} />;
}

export function BinsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    data: bins,
    error,
    refreshing,
    reload: load,
  } = useAsyncData(api.trashBins.list, 'Falha ao carregar lixeiras');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrashBin | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [pendingDelete, setPendingDelete] = useState<TrashBin | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const canManageBins = user?.role === 'ADMIN';

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

  function requestRemove(bin: TrashBin) {
    if (!canManageBins) return;
    setDeleteError(null);
    setPendingDelete(bin);
  }

  function cancelRemove() {
    setPendingDelete(null);
    setDeleteError(null);
  }

  async function confirmRemove() {
    if (!pendingDelete || !canManageBins) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.trashBins.remove(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch (err: unknown) {
      setDeleteError(err instanceof ApiError ? err.message : 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  }

  const stats = useMemo(() => {
    if (!bins) return null;
    const fillSamples = bins
      .map((b) => b.fillLevel)
      .filter((v): v is number => v !== null);
    const avgFill = fillSamples.length
      ? Math.round(fillSamples.reduce((sum, v) => sum + v, 0) / fillSamples.length)
      : null;
    return {
      total: bins.length,
      full: bins.filter((b) => b.status === 'full').length,
      lowBattery: bins.filter((b) => b.batteryLevel !== null && b.batteryLevel <= 15).length,
      offline: bins.filter((b) => b.status === 'offline').length,
      avgFill,
    };
  }, [bins]);

  // Count per status for the filter chips.
  const statusCounts = useMemo(() => {
    const counts = { all: bins?.length ?? 0 } as Record<StatusFilter, number>;
    (Object.keys(TRASH_BIN_STATUS_LABELS) as TrashBinStatus[]).forEach((s) => {
      counts[s] = bins?.filter((b) => b.status === s).length ?? 0;
    });
    return counts;
  }, [bins]);

  const visibleBins = useMemo(() => {
    if (!bins) return [];
    const q = query.trim().toLowerCase();
    return bins
      .filter((b) => statusFilter === 'all' || b.status === statusFilter)
      .filter((b) => {
        if (!q) return true;
        return (
          b.name.toLowerCase().includes(q) ||
          b.code.toLowerCase().includes(q) ||
          b.location?.name?.toLowerCase().includes(q) ||
          b.locationDescription?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const sd = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        if (sd !== 0) return sd;
        return (b.fillLevel ?? 0) - (a.fillLevel ?? 0);
      });
  }, [bins, query, statusFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Lixeiras</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro e monitoramento das lixeiras inteligentes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={refreshing}
            aria-label="Atualizar"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Atualizar
          </Button>
          {canManageBins && (
            <Button onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" />
              Nova lixeira
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorState message={error} />}

      {!bins && !error && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-28" />
            ))}
          </div>
          <SkeletonBlock className="h-64" />
        </div>
      )}

      {bins && stats && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total de lixeiras"
              value={stats.total}
              hint={stats.avgFill !== null ? `Preenchimento médio: ${stats.avgFill}%` : 'Cadastradas no sistema'}
              Icon={Trash2}
              tone="primary"
            />
            <StatCard
              label="Lixeiras cheias"
              value={stats.full}
              hint={stats.total ? `${Math.round((stats.full / stats.total) * 100)}% da frota` : 'Precisam de coleta'}
              Icon={AlertTriangle}
              tone="destructive"
            />
            <StatCard
              label="Bateria baixa"
              value={stats.lowBattery}
              hint={stats.offline > 0 ? `${stats.offline} offline` : 'Sensores ≤ 15%'}
              Icon={BatteryLow}
              tone="warning"
            />
            <StatCard
              label="Preenchimento médio"
              value={stats.avgFill !== null ? `${stats.avgFill}%` : '—'}
              hint="Média da frota"
              Icon={Gauge}
              tone="info"
            />
          </div>

          {bins.length === 0 ? (
            <EmptyState label="Nenhuma lixeira cadastrada ainda." />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-56 flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nome, código ou local"
                    className="pl-8"
                  />
                </div>
                <FilterChips
                  options={[
                    { value: 'all' as StatusFilter, label: 'Todas', count: statusCounts.all },
                    ...(Object.keys(TRASH_BIN_STATUS_LABELS) as TrashBinStatus[]).map((s) => ({
                      value: s as StatusFilter,
                      label: TRASH_BIN_STATUS_LABELS[s],
                      count: statusCounts[s],
                    })),
                  ]}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              </div>

              {visibleBins.length === 0 ? (
                <EmptyState label="Nenhuma lixeira corresponde aos filtros." />
              ) : (
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
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleBins.map((bin) => (
                        <TableRow key={bin.id}>
                          <TableCell>
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                              {bin.code}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold">{bin.name}</div>
                            {(bin.location?.name || bin.locationDescription) && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {bin.location?.name ?? bin.locationDescription}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <TrashBinStatusBadge status={bin.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <FillBar value={bin.fillLevel} />
                              {bin.forecast && (
                                <span
                                  className="text-[10px] text-muted-foreground"
                                  title={`Projeção: ~${bin.forecast.slopePerHour} pp/h (${bin.forecast.samples} leituras)`}
                                >
                                  cheia em ~{formatEta(bin.forecast.etaHours)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <BatteryIndicator value={bin.batteryLevel} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatRelativeTime(bin.lastSeenAt)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {formatCoord(bin.latitude)}, {formatCoord(bin.longitude)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/map?bin=${bin.id}`)}
                              >
                                <MapPin className="h-4 w-4" />
                                Ver no mapa
                              </Button>
                              {bin.location?.isBuilding && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/locations/${bin.locationId}/building`)}
                                >
                                  Ver construção
                                </Button>
                              )}
                              {canManageBins && (
                                <>
                                  <Button variant="outline" size="sm" onClick={() => openEdit(bin)}>
                                    Editar
                                  </Button>
                                  <Button variant="destructive" size="sm" onClick={() => requestRemove(bin)}>
                                    Excluir
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </>
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

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir lixeira"
        description={
          pendingDelete && (
            <>
              A lixeira <strong>{pendingDelete.name}</strong> será removida. A posição vinculada
              também sai do mapa, a menos que outra lixeira a utilize. Esta ação não pode ser
              desfeita.
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

function formatEta(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${Math.round(hours / 24)} d`;
}
