import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { ErrorState, LoadingState, EmptyState } from '@/components/States';
import type { CreateTaskInput, Location, TrashBin, User } from '@/types';
import { TrashBinMap } from '@/modules/trash-bins/components/TrashBinMap';
import { Modal } from '@/components/Modal';
import { TaskForm } from '@/modules/tasks/components';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';

export function MapPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusBinId = searchParams.get('bin');
  const focusLocationId = searchParams.get('location');
  const [bins, setBins] = useState<TrashBin[] | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<TrashBin | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const canCreateTasks = user?.role === 'ADMIN';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        if (canCreateTasks) {
          const [binData, locationData, userData] = await Promise.all([
            api.trashBins.list(),
            api.locations.list(),
            api.users.list(),
          ]);
          if (cancelled) return;
          setBins(binData);
          setLocations(locationData);
          setUsers(userData);
          return;
        }

        const [binData, locationData] = await Promise.all([
          api.trashBins.list(),
          api.locations.list(),
        ]);
        if (cancelled) return;
        setBins(binData);
        setLocations(locationData);
        setUsers([]);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Falha ao carregar mapa');
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [canCreateTasks]);

  const center = useMemo<[number, number]>(() => {
    if (focusBinId && bins) {
      const target = bins.find((b) => b.id === focusBinId);
      if (target) return [target.latitude, target.longitude];
    }
    if (focusLocationId) {
      const target = locations.find((l) => l.id === focusLocationId);
      if (target) return [target.latitude, target.longitude];
    }
    const points = [
      ...(bins ?? []).map((b) => ({ lat: b.latitude, lng: b.longitude })),
      ...locations.map((l) => ({ lat: l.latitude, lng: l.longitude })),
    ];
    if (points.length === 0) return [-23.5874, -46.6576];
    const sum = points.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 },
    );
    return [sum.lat / points.length, sum.lng / points.length];
  }, [bins, locations, focusBinId, focusLocationId]);

  // Posições que ainda não têm uma lixeira (evita marcadores sobrepostos).
  const freeLocations = useMemo(() => {
    const occupied = new Set((bins ?? []).map((b) => b.locationId));
    return locations.filter((loc) => !occupied.has(loc.id));
  }, [bins, locations]);

  const hasMapData = (bins?.length ?? 0) > 0 || freeLocations.length > 0;

  function openTaskForBin(bin: TrashBin) {
    if (!canCreateTasks) return;
    setSelectedLocation(null);
    setSelectedBin(bin);
    setFormError(null);
  }

  function openTaskForLocation(location: Location) {
    if (!canCreateTasks) return;
    setSelectedBin(null);
    setSelectedLocation(location);
    setFormError(null);
  }

  function closeTaskModal() {
    setSelectedBin(null);
    setSelectedLocation(null);
    setFormError(null);
  }

  async function handleTaskSubmit(values: CreateTaskInput) {
    if (!canCreateTasks || (!selectedBin && !selectedLocation)) return;
    setSubmitting(true);
    setFormError(null);
    let createdTaskId: string | null = null;
    try {
      const created = await api.tasks.create({
        ...values,
        trashBinId: values.trashBinId ?? selectedBin?.id ?? null,
        locationId: values.locationId ?? selectedLocation?.id ?? null,
      });
      createdTaskId = created.id;
      closeTaskModal();
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao criar tarefa');
    } finally {
      setSubmitting(false);
    }
    if (createdTaskId) navigate(`/tasks?task=${createdTaskId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mapa</h1>
          <p className="mt-1 text-sm text-muted-foreground">Posições e lixeiras em tempo real</p>
        </div>
        {canCreateTasks && (
          <Button onClick={() => navigate('/locations')}>
            <MapPin className="h-4 w-4" />
            Adicionar localização
          </Button>
        )}
      </div>

      {error && <ErrorState message={error} />}
      {!bins && !error && <LoadingState label="Carregando mapa..." />}
      {bins && !hasMapData && (
        <EmptyState label="Sem posições ou lixeiras cadastradas para exibir no mapa." />
      )}
      {bins && hasMapData && (
        <div className="min-h-[480px] overflow-hidden rounded-xl border border-border" style={{ height: 'calc(100vh - 200px)' }}>
          <TrashBinMap
            bins={bins}
            locations={freeLocations}
            center={center}
            focusBinId={focusBinId}
            focusLocationId={focusLocationId}
            onCreateTask={canCreateTasks ? openTaskForBin : undefined}
            onCreateTaskForLocation={canCreateTasks ? openTaskForLocation : undefined}
          />
        </div>
      )}

      {canCreateTasks && selectedBin && (
        <Modal
          open={!!selectedBin}
          title={`Nova tarefa - ${selectedBin.code}`}
          onClose={closeTaskModal}
        >
          {formError && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          <TaskForm
            key={selectedBin.id}
            target={{ kind: 'bin', bin: selectedBin }}
            bins={bins ?? []}
            locations={freeLocations}
            users={users}
            submitting={submitting}
            onCancel={closeTaskModal}
            onSubmit={handleTaskSubmit}
          />
        </Modal>
      )}

      {canCreateTasks && selectedLocation && (
        <Modal
          open={!!selectedLocation}
          title={`Nova tarefa - ${selectedLocation.name}`}
          onClose={closeTaskModal}
        >
          {formError && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          <TaskForm
            key={selectedLocation.id}
            target={{ kind: 'location', location: selectedLocation }}
            bins={bins ?? []}
            locations={freeLocations}
            users={users}
            submitting={submitting}
            onCancel={closeTaskModal}
            onSubmit={handleTaskSubmit}
          />
        </Modal>
      )}
    </div>
  );
}
