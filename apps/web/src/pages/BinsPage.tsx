import { useEffect, useMemo, useState } from 'react';
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
import { api, ApiError } from '../lib/api';
import type { CreateTrashBinInput, TrashBin, TrashBinStatus } from '../types';
import { TRASH_BIN_STATUS_LABELS } from '../types';
import { ErrorState, EmptyState } from '../components/States';
import { TrashBinStatusBadge } from '../components/StatusBadge';
import { FillBar } from '../components/FillBar';
import { BatteryIndicator } from '../components/BatteryIndicator';
import { Modal } from '../components/Modal';
import { TrashBinForm } from '../components/TrashBinForm';
import { formatCoord, formatRelativeTime } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
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

// Compact KPI tile with a tinted icon chip, matching the dashboard style.
function StatCard({
  label,
  value,
  hint,
  Icon,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  Icon: typeof Trash2;
  tone: 'primary' | 'destructive' | 'warning' | 'info';
}) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    destructive: 'bg-destructive/10 text-destructive',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  }[tone];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardDescription>{label}</CardDescription>
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', toneClass)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} />;
}

export function BinsPage() {
  const { user } = useAuth();
  const [bins, setBins] = useState<TrashBin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrashBin | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const canManageBins = user?.role === 'ADMIN';

  async function load() {
    setError(null);
    setRefreshing(true);
    try {
      const data = await api.trashBins.list();
      setBins(data);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar lixeiras');
    } finally {
      setRefreshing(false);
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
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip
                    label="Todas"
                    count={statusCounts.all}
                    active={statusFilter === 'all'}
                    onClick={() => setStatusFilter('all')}
                  />
                  {(Object.keys(TRASH_BIN_STATUS_LABELS) as TrashBinStatus[]).map((s) => (
                    <FilterChip
                      key={s}
                      label={TRASH_BIN_STATUS_LABELS[s]}
                      count={statusCounts[s]}
                      active={statusFilter === s}
                      onClick={() => setStatusFilter(s)}
                    />
                  ))}
                </div>
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
                        {canManageBins && <TableHead className="text-right">Ações</TableHead>}
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
                            <FillBar value={bin.fillLevel} />
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
    </div>
  );
}

// Toggleable status filter pill with a count badge.
function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
      <span
        className={cn(
          'tabular-nums',
          active ? 'text-primary-foreground/80' : 'text-foreground/60',
        )}
      >
        {count}
      </span>
    </button>
  );
}
