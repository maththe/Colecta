import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { ErrorState, LoadingState, EmptyState } from '@/components/States';
import type { CreateTaskInput, Location, SecurityCamera, TrashBin, User } from '@/types';
import { TrashBinMap } from '@/modules/trash-bins/components/TrashBinMap';
import { occurrenceLink } from '@/modules/security/lib/occurrence-link';
import { Modal } from '@/components/Modal';
import { FilterChips } from '@/components/ui/filter-chips';
import { TaskForm } from '@/modules/tasks/components';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';

// Filtro de quais marcadores aparecem no mapa.
type MapMarkerFilter = 'all' | 'cameras' | 'locations' | 'bins';

const MARKER_FILTERS: { value: MapMarkerFilter; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: 'cameras', label: 'Câmeras' },
  { value: 'locations', label: 'Localizações' },
  { value: 'bins', label: 'Lixeiras' },
];

export function MapPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusBinId = searchParams.get('bin');
  const focusLocationId = searchParams.get('location');
  const focusCameraId = searchParams.get('camera');
  const [bins, setBins] = useState<TrashBin[] | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [cameras, setCameras] = useState<SecurityCamera[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<TrashBin | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<SecurityCamera | null>(null);
  const [markerFilter, setMarkerFilter] = useState<MapMarkerFilter>('all');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const canCreateTasks = user?.role === 'ADMIN';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        if (canCreateTasks) {
          const [binData, locationData, cameraData, userData] = await Promise.all([
            api.trashBins.list(),
            api.locations.list(),
            api.cameras.list(),
            api.users.list(),
          ]);
          if (cancelled) return;
          setBins(binData);
          setLocations(locationData);
          setCameras(cameraData);
          setUsers(userData);
          return;
        }

        const [binData, locationData, cameraData] = await Promise.all([
          api.trashBins.list(),
          api.locations.list(),
          api.cameras.list(),
        ]);
        if (cancelled) return;
        setBins(binData);
        setLocations(locationData);
        setCameras(cameraData);
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
    if (focusCameraId) {
      const target = cameras.find((c) => c.id === focusCameraId);
      if (target) return [target.latitude, target.longitude];
    }
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
  }, [bins, locations, cameras, focusBinId, focusLocationId, focusCameraId]);

  // Posições que ainda não têm uma lixeira — usadas no formulário de tarefa
  // para oferecer apenas locais disponíveis ao vincular uma nova lixeira.
  const freeLocations = useMemo(() => {
    const occupied = new Set((bins ?? []).map((b) => b.locationId));
    return locations.filter((loc) => !occupied.has(loc.id));
  }, [bins, locations]);

  const hasMapData =
    (bins?.length ?? 0) > 0 || locations.length > 0 || cameras.length > 0;

  // Marcadores exibidos conforme o filtro selecionado. Ao focar um marcador via
  // deep-link (ex.: "ver no mapa" de uma tarefa), garantimos que apenas o
  // marcador focado apareça mesmo que o filtro esteja em outra categoria — sem
  // reativar a categoria inteira, caso contrário o filtro ficaria inutilizável
  // após chegar ao mapa por um deep-link.
  const showBins = markerFilter === 'all' || markerFilter === 'bins';
  const showLocations = markerFilter === 'all' || markerFilter === 'locations';
  const showCameras = markerFilter === 'all' || markerFilter === 'cameras';

  const visibleBins = useMemo(() => {
    if (showBins) return bins ?? [];
    const focused = focusBinId ? (bins ?? []).find((b) => b.id === focusBinId) : undefined;
    return focused ? [focused] : [];
  }, [bins, showBins, focusBinId]);

  const visibleLocations = useMemo(() => {
    // Mostramos todas as posições tanto no "Tudo" quanto no filtro dedicado —
    // como as lixeiras são levemente deslocadas no mapa (ver TrashBinMap), o
    // marcador azul da posição não fica mais escondido embaixo das lixeiras.
    if (showLocations) return locations;
    const focused = focusLocationId ? locations.find((l) => l.id === focusLocationId) : undefined;
    return focused ? [focused] : [];
  }, [locations, showLocations, focusLocationId]);

  const visibleCameras = useMemo(() => {
    if (showCameras) return cameras;
    const focused = focusCameraId ? cameras.find((c) => c.id === focusCameraId) : undefined;
    return focused ? [focused] : [];
  }, [cameras, showCameras, focusCameraId]);

  // Vínculo (lixeira/posição real) resolvido para a câmera selecionada — usado
  // para pré-preencher o local da tarefa criada a partir de uma câmera.
  const cameraLink = useMemo(
    () => (selectedCamera ? occurrenceLink(selectedCamera, locations, bins ?? []) : null),
    [selectedCamera, locations, bins],
  );

  function openTaskForBin(bin: TrashBin) {
    if (!canCreateTasks) return;
    setSelectedLocation(null);
    setSelectedCamera(null);
    setSelectedBin(bin);
    setFormError(null);
  }

  function openTaskForLocation(location: Location) {
    if (!canCreateTasks) return;
    setSelectedBin(null);
    setSelectedCamera(null);
    setSelectedLocation(location);
    setFormError(null);
  }

  function openTaskForCamera(camera: SecurityCamera) {
    if (!canCreateTasks) return;
    setSelectedBin(null);
    setSelectedLocation(null);
    setSelectedCamera(camera);
    setFormError(null);
  }

  function closeTaskModal() {
    setSelectedBin(null);
    setSelectedLocation(null);
    setSelectedCamera(null);
    setFormError(null);
  }

  async function handleTaskSubmit(values: CreateTaskInput) {
    if (!canCreateTasks || (!selectedBin && !selectedLocation && !selectedCamera)) return;
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
        <div className="flex flex-wrap items-center gap-3">
          <FilterChips options={MARKER_FILTERS} value={markerFilter} onChange={setMarkerFilter} />
          {canCreateTasks && (
            <Button onClick={() => navigate('/locations')}>
              <MapPin className="h-4 w-4" />
              Adicionar localização
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorState message={error} />}
      {!bins && !error && <LoadingState label="Carregando mapa..." />}
      {bins && !hasMapData && (
        <EmptyState label="Sem posições ou lixeiras cadastradas para exibir no mapa." />
      )}
      {bins && hasMapData && (
        <div className="min-h-[480px] overflow-hidden rounded-xl border border-border" style={{ height: 'calc(100vh - 200px)' }}>
          <TrashBinMap
            bins={visibleBins}
            locations={visibleLocations}
            cameras={visibleCameras}
            center={center}
            focusBinId={focusBinId}
            focusLocationId={focusLocationId}
            focusCameraId={focusCameraId}
            onCreateTask={canCreateTasks ? openTaskForBin : undefined}
            onCreateTaskForLocation={canCreateTasks ? openTaskForLocation : undefined}
            onCreateTaskForCamera={canCreateTasks ? openTaskForCamera : undefined}
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

      {canCreateTasks && selectedCamera && (
        <Modal
          open={!!selectedCamera}
          title={`Nova tarefa - ${selectedCamera.name}`}
          onClose={closeTaskModal}
        >
          {formError && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          <TaskForm
            key={selectedCamera.id}
            defaults={{
              trashBinId: cameraLink?.trashBinId ?? undefined,
              locationId: cameraLink?.locationId ?? undefined,
            }}
            bins={bins ?? []}
            locations={locations}
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
