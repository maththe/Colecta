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
import { canSeeTrashBins } from '@/types';
import { Button } from '@/components/ui/button';
import { CheckCircle2, MapPin, Play } from 'lucide-react';

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
  // Tarefa que o funcionário veio iniciar pelo "Visualizar no mapa". Só esse
  // fluxo passa esse parâmetro, então o botão "Iniciar tarefa" só aparece aqui.
  const startTaskId = searchParams.get('startTask');
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
  // Tarefa carregada para o atalho de iniciar pelo mapa (ver `startTaskId`).
  const [startTask, setStartTask] = useState<Task | null>(null);
  const [startingTask, setStartingTask] = useState(false);
  const [startTaskError, setStartTaskError] = useState<string | null>(null);
  // Aviso temporário (3s) exibido ao iniciar uma tarefa pelo mapa.
  const [startedToast, setStartedToast] = useState<string | null>(null);
  const canCreateTasks = user?.role === 'ADMIN';
  // Câmeras só são visíveis para ADMIN e SEGURANCA (regra também imposta no servidor).
  const canViewCameras = user?.role === 'ADMIN' || user?.role === 'SEGURANCA';
  // SEGURANCA não vê lixeiras: o endpoint responde 403, então nem chamamos.
  const canSeeBins = canSeeTrashBins(user?.role);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        // Só busca câmeras/lixeiras quem pode vê-las; os demais nem chamam o
        // endpoint (que agora responde 403 para papéis sem permissão).
        const camerasPromise = canViewCameras
          ? api.cameras.list()
          : Promise.resolve<SecurityCamera[]>([]);
        const binsPromise = canSeeBins
          ? api.trashBins.list()
          : Promise.resolve<TrashBin[]>([]);

        if (canCreateTasks) {
          const [binData, locationData, cameraData, userData, taskData] = await Promise.all([
            binsPromise,
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
          binsPromise,
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
  }, [canCreateTasks, canViewCameras, canSeeBins]);

  // Carrega a tarefa do atalho "Iniciar no mapa". Buscamos por id porque ela
  // pode não estar entre os marcadores do mapa (ex.: ocorrência de câmera, que
  // não tem coordenada própria).
  useEffect(() => {
    if (!startTaskId) {
      setStartTask(null);
      return;
    }
    let cancelled = false;
    setStartTaskError(null);
    api.tasks
      .get(startTaskId)
      .then((task) => {
        if (!cancelled) setStartTask(task);
      })
      .catch(() => {
        if (!cancelled) setStartTask(null);
      });
    return () => {
      cancelled = true;
    };
  }, [startTaskId]);

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

  // Esconde filtros que o papel não pode ver: "Câmeras" (sem permissão) e
  // "Lixeiras" (SEGURANCA não vê nada relacionado a lixeiras).
  const markerFilters = useMemo(
    () =>
      MARKER_FILTERS.filter(
        (filter) =>
          (filter.value !== 'cameras' || canViewCameras) &&
          (filter.value !== 'bins' || canSeeBins),
      ),
    [canViewCameras, canSeeBins],
  );

  // Marcadores exibidos conforme o filtro selecionado. O filtro é autoritativo:
  // ao trocar de categoria, o marcador some — mesmo que tenha sido focado por um
  // deep-link ("ver no mapa"). O deep-link continua funcionando porque o filtro
  // começa em "Tudo" ao chegar no mapa, então o marcador aparece e o mapa voa
  // até ele; trocar o filtro depois apenas oculta a categoria, como esperado.
  const showBins = markerFilter === 'all' || markerFilter === 'bins';
  const showLocations = markerFilter === 'all' || markerFilter === 'locations';
  const showCameras = markerFilter === 'all' || markerFilter === 'cameras';
  const showTasks = markerFilter === 'all' || markerFilter === 'tasks';

  const visibleBins = useMemo(() => (showBins ? bins ?? [] : []), [bins, showBins]);

  const visibleLocations = useMemo(
    () => (showLocations ? locations : []),
    [locations, showLocations],
  );

  const visibleCameras = useMemo(() => (showCameras ? cameras : []), [cameras, showCameras]);

  const visibleTasks = useMemo(() => (showTasks ? tasks : []), [tasks, showTasks]);

  // Recarrega só os marcadores de tarefa (após criar uma) sem repuxar o resto.
  async function reloadTasks() {
    try {
      const taskData = await api.tasks.mapTasks();
      setTasks(taskData);
    } catch {
      // Falha silenciosa: os demais marcadores seguem válidos no mapa.
    }
  }

  // O aviso de "tarefa iniciada" some sozinho após 3 segundos.
  useEffect(() => {
    if (!startedToast) return;
    const timer = setTimeout(() => setStartedToast(null), 3000);
    return () => clearTimeout(timer);
  }, [startedToast]);

  // Inicia a tarefa do atalho do mapa (pending → in_progress). Some o banner ao
  // concluir e atualiza os marcadores de tarefa.
  async function handleStartTask() {
    if (!startTask || startingTask) return;
    setStartingTask(true);
    setStartTaskError(null);
    try {
      await api.tasks.update(startTask.id, { status: 'in_progress' });
      setStartedToast(startTask.title);
      setStartTask(null);
      await reloadTasks();
    } catch (err: unknown) {
      setStartTaskError(err instanceof ApiError ? err.message : 'Erro ao iniciar a tarefa');
    } finally {
      setStartingTask(false);
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
        cameraId: selectedCamera?.id ?? null,
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
          <p className="mt-1 text-sm text-muted-foreground">
            {canSeeBins ? 'Posições e lixeiras em tempo real' : 'Posições e câmeras em tempo real'}
          </p>
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

      {startTask && startTask.status === 'pending' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-sm">
          <span>
            <strong>{startTask.title}</strong> — pronta para iniciar
          </span>
          <div className="flex items-center gap-2">
            {startTaskError && <span className="text-destructive">{startTaskError}</span>}
            <Button
              type="button"
              disabled={startingTask}
              onClick={handleStartTask}
              className="border-blue-500 bg-blue-500 text-white hover:bg-blue-600"
            >
              <Play className="h-4 w-4" />
              {startingTask ? 'Iniciando...' : 'Iniciar tarefa'}
            </Button>
          </div>
        </div>
      )}

      {error && <ErrorState message={error} />}
      {!bins && !error && <LoadingState label="Carregando mapa..." />}
      {bins && !hasMapData && (
        <EmptyState
          label={
            canSeeBins
              ? 'Sem posições ou lixeiras cadastradas para exibir no mapa.'
              : 'Sem posições cadastradas para exibir no mapa.'
          }
        />
      )}
      {bins && hasMapData && (
        <div className="relative min-h-[480px] overflow-hidden rounded-xl border border-border" style={{ height: 'calc(100vh - 200px)' }}>
          {startedToast && (
            <div
              role="status"
              aria-live="polite"
              className="animate-toast-in absolute right-4 top-4 z-[1000] flex items-center gap-2.5 rounded-xl border border-primary/30 bg-card px-4 py-3 text-sm shadow-lg"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
              <span>
                Tarefa <strong>{startedToast}</strong> iniciada
              </span>
            </div>
          )}
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
            onViewBuilding={
              canSeeBins ? (locationId) => navigate(`/locations/${locationId}/building`) : undefined
            }
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
