import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { ErrorState, LoadingState, EmptyState } from '@/components/States';
import type {
  CreateSecurityOccurrenceInput,
  CreateTaskInput,
  Location,
  SecurityCamera,
  Task,
  TrashBin,
  User,
} from '@/types';
import { TrashBinMap } from '@/modules/trash-bins/components/TrashBinMap';
import { CameraPreviewDialog, ReportOccurrenceDialog } from '@/modules/security/components';
import { occurrenceLink } from '@/modules/security/lib/occurrence-link';
import { Modal } from '@/components/Modal';
import { FilterChips } from '@/components/ui/filter-chips';
import { TaskForm } from '@/modules/tasks/components';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';

// Filtro de quais marcadores aparecem no mapa.
type MapMarkerFilter = 'all' | 'cameras' | 'locations' | 'bins' | 'tasks';

const MARKER_FILTERS: { value: MapMarkerFilter; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: 'cameras', label: 'Câmeras' },
  { value: 'locations', label: 'Localizações' },
  { value: 'bins', label: 'Lixeiras' },
  { value: 'tasks', label: 'Tarefas' },
];

export function MapPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusBinId = searchParams.get('bin');
  const focusLocationId = searchParams.get('location');
  const focusCameraId = searchParams.get('camera');
  const focusTaskId = searchParams.get('task');
  const [bins, setBins] = useState<TrashBin[] | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [cameras, setCameras] = useState<SecurityCamera[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<TrashBin | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<SecurityCamera | null>(null);
  // Câmera cuja imagem está sendo visualizada no modal (independe de permissão).
  const [previewCamera, setPreviewCamera] = useState<SecurityCamera | null>(null);
  // Fluxo de relatar ocorrência a partir do modal da câmera.
  const [reportCamera, setReportCamera] = useState<SecurityCamera | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  // Coordenada escolhida ao clicar no mapa para criar uma tarefa avulsa.
  const [pickedPoint, setPickedPoint] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [picking, setPicking] = useState(false);
  const [markerFilter, setMarkerFilter] = useState<MapMarkerFilter>('all');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const canCreateTasks = user?.role === 'ADMIN';
  // Câmeras só são visíveis para ADMIN e SEGURANCA (regra também imposta no servidor).
  const canViewCameras = user?.role === 'ADMIN' || user?.role === 'SEGURANCA';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        // Só busca câmeras quem pode vê-las; os demais nem chamam o endpoint
        // (que agora responde 403 para papéis sem permissão).
        const camerasPromise = canViewCameras
          ? api.cameras.list()
          : Promise.resolve<SecurityCamera[]>([]);

        if (canCreateTasks) {
          const [binData, locationData, cameraData, userData, taskData] = await Promise.all([
            api.trashBins.list(),
            api.locations.list(),
            camerasPromise,
            api.users.list(),
            api.tasks.mapTasks(),
          ]);
          if (cancelled) return;
          setBins(binData);
          setLocations(locationData);
          setCameras(cameraData);
          setUsers(userData);
          setTasks(taskData);
          return;
        }

        const [binData, locationData, cameraData, taskData] = await Promise.all([
          api.trashBins.list(),
          api.locations.list(),
          camerasPromise,
          api.tasks.mapTasks(),
        ]);
        if (cancelled) return;
        setBins(binData);
        setLocations(locationData);
        setCameras(cameraData);
        setUsers([]);
        setTasks(taskData);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Falha ao carregar mapa');
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [canCreateTasks, canViewCameras]);

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
    if (focusTaskId) {
      const target = tasks.find((t) => t.id === focusTaskId);
      if (target && target.latitude !== null && target.longitude !== null) {
        return [target.latitude, target.longitude];
      }
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
  }, [bins, locations, cameras, tasks, focusBinId, focusLocationId, focusCameraId, focusTaskId]);

  // Posições que ainda não têm uma lixeira — usadas no formulário de tarefa
  // para oferecer apenas locais disponíveis ao vincular uma nova lixeira.
  const freeLocations = useMemo(() => {
    const occupied = new Set((bins ?? []).map((b) => b.locationId));
    return locations.filter((loc) => !occupied.has(loc.id));
  }, [bins, locations]);

  const hasMapData =
    (bins?.length ?? 0) > 0 || locations.length > 0 || cameras.length > 0;

  // Sem permissão para câmeras, o filtro "Câmeras" não faz sentido.
  const markerFilters = useMemo(
    () =>
      canViewCameras
        ? MARKER_FILTERS
        : MARKER_FILTERS.filter((filter) => filter.value !== 'cameras'),
    [canViewCameras],
  );

  // Marcadores exibidos conforme o filtro selecionado. Ao focar um marcador via
  // deep-link (ex.: "ver no mapa" de uma tarefa), garantimos que apenas o
  // marcador focado apareça mesmo que o filtro esteja em outra categoria — sem
  // reativar a categoria inteira, caso contrário o filtro ficaria inutilizável
  // após chegar ao mapa por um deep-link.
  const showBins = markerFilter === 'all' || markerFilter === 'bins';
  const showLocations = markerFilter === 'all' || markerFilter === 'locations';
  const showCameras = markerFilter === 'all' || markerFilter === 'cameras';
  const showTasks = markerFilter === 'all' || markerFilter === 'tasks';

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

  const visibleTasks = useMemo(() => {
    if (showTasks) return tasks;
    const focused = focusTaskId ? tasks.find((t) => t.id === focusTaskId) : undefined;
    return focused ? [focused] : [];
  }, [tasks, showTasks, focusTaskId]);

  // Recarrega só os marcadores de tarefa (após criar uma) sem repuxar o resto.
  async function reloadTasks() {
    try {
      const taskData = await api.tasks.mapTasks();
      setTasks(taskData);
    } catch {
      // Falha silenciosa: os demais marcadores seguem válidos no mapa.
    }
  }

  // Vínculo (lixeira/posição real) resolvido para a câmera selecionada — usado
  // para pré-preencher o local da tarefa criada a partir de uma câmera.
  const cameraLink = useMemo(
    () => (selectedCamera ? occurrenceLink(selectedCamera, locations, bins ?? []) : null),
    [selectedCamera, locations, bins],
  );

  // Vínculo da ocorrência relatada pelo modal da câmera.
  const reportLink = useMemo(
    () => (reportCamera ? occurrenceLink(reportCamera, locations, bins ?? []) : null),
    [reportCamera, locations, bins],
  );

  // Do modal de imagem para o formulário de ocorrência (fecha um, abre o outro).
  function openReportFromPreview(camera: SecurityCamera) {
    setPreviewCamera(null);
    setReportError(null);
    setReportCamera(camera);
  }

  function closeReport() {
    if (reporting) return;
    setReportCamera(null);
    setReportError(null);
  }

  async function handleReportSubmit(values: CreateSecurityOccurrenceInput) {
    setReporting(true);
    setReportError(null);
    let createdTaskId: string | null = null;
    try {
      const created = await api.tasks.createSecurityOccurrence(values);
      createdTaskId = created.id;
      setReportCamera(null);
    } catch (err: unknown) {
      setReportError(err instanceof ApiError ? err.message : 'Erro ao criar ocorrência');
    } finally {
      setReporting(false);
    }
    if (createdTaskId) navigate(`/tasks?task=${createdTaskId}`);
  }

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

  // Liga/desliga o modo de clicar no mapa para posicionar uma tarefa avulsa.
  function togglePicking() {
    if (!canCreateTasks) return;
    closeTaskModal();
    setPicking((prev) => !prev);
  }

  // Clique no mapa (modo seleção): fixa a coordenada e abre o formulário.
  function handlePickPoint(latitude: number, longitude: number) {
    if (!canCreateTasks) return;
    setSelectedBin(null);
    setSelectedLocation(null);
    setSelectedCamera(null);
    setPicking(false);
    setFormError(null);
    setPickedPoint({ latitude, longitude });
  }

  function closeTaskModal() {
    setSelectedBin(null);
    setSelectedLocation(null);
    setSelectedCamera(null);
    setPickedPoint(null);
    setFormError(null);
  }

  async function handleTaskSubmit(values: CreateTaskInput) {
    if (
      !canCreateTasks ||
      (!selectedBin && !selectedLocation && !selectedCamera && !pickedPoint)
    ) {
      return;
    }
    const isPointTask = !!pickedPoint;
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
    // Tarefa avulsa do mapa: fica na própria tela e atualiza os marcadores.
    // As demais (lixeira/posição/câmera) seguem para o quadro de tarefas.
    if (createdTaskId) {
      if (isPointTask) await reloadTasks();
      else navigate(`/tasks?task=${createdTaskId}`);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mapa</h1>
          <p className="mt-1 text-sm text-muted-foreground">Posições e lixeiras em tempo real</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterChips options={markerFilters} value={markerFilter} onChange={setMarkerFilter} />
          {canCreateTasks && (
            <>
              <Button
                variant={picking ? 'default' : 'outline'}
                onClick={togglePicking}
              >
                <MapPin className="h-4 w-4" />
                {picking ? 'Cancelar seleção' : 'Definir tarefa no mapa'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/locations')}>
                <MapPin className="h-4 w-4" />
                Adicionar localização
              </Button>
            </>
          )}
        </div>
      </div>

      {picking && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          Clique no mapa para escolher o local da nova tarefa.
        </div>
      )}

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
            tasks={visibleTasks}
            center={center}
            focusBinId={focusBinId}
            focusLocationId={focusLocationId}
            focusCameraId={focusCameraId}
            focusTaskId={focusTaskId}
            picking={picking}
            onPickPoint={canCreateTasks ? handlePickPoint : undefined}
            onSelectTask={(task) => navigate(`/tasks?task=${task.id}`)}
            onCreateTask={canCreateTasks ? openTaskForBin : undefined}
            onCreateTaskForLocation={canCreateTasks ? openTaskForLocation : undefined}
            onCreateTaskForCamera={canCreateTasks ? openTaskForCamera : undefined}
            onViewCameraImage={canViewCameras ? setPreviewCamera : undefined}
          />
        </div>
      )}

      <CameraPreviewDialog
        camera={previewCamera}
        onClose={() => setPreviewCamera(null)}
        onReport={openReportFromPreview}
      />
      <ReportOccurrenceDialog
        camera={reportCamera}
        link={reportLink}
        referenceError={null}
        submitting={reporting}
        error={reportError}
        onClose={closeReport}
        onSubmit={handleReportSubmit}
      />

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

      {canCreateTasks && pickedPoint && (
        <Modal
          open={!!pickedPoint}
          title="Nova tarefa no mapa"
          onClose={closeTaskModal}
        >
          {formError && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          <TaskForm
            key={`${pickedPoint.latitude},${pickedPoint.longitude}`}
            target={{
              kind: 'point',
              latitude: pickedPoint.latitude,
              longitude: pickedPoint.longitude,
            }}
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
