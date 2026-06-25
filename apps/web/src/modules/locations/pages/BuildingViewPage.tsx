import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ImageOverlay, MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, Camera, CheckCircle2, Eye, ImagePlus, MapPin, Play, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { ErrorState, LoadingState } from '@/components/States';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { FilterChips } from '@/components/ui/filter-chips';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { TrashBinForm } from '@/modules/trash-bins/components/TrashBinForm';
import { TaskForm } from '@/modules/tasks/components';
import { CameraPreviewDialog, ReportOccurrenceDialog } from '@/modules/security/components';
import { occurrenceLink } from '@/modules/security/lib/occurrence-link';
import {
  buildMarkerIcon,
  CAMERA_COLOR,
  MARKER_ICONS,
  STATUS_COLOR,
  TASK_COLOR,
} from '@/modules/trash-bins/components/map-markers';
import {
  CAMERA_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TRASH_BIN_STATUS_LABELS,
  USER_ROLE_LABELS,
} from '@/types';
import { formatRelativeTime } from '@/lib/format';
import type {
  BuildingBin,
  BuildingMap,
  BuildingTask,
  CreateSecurityOccurrenceInput,
  CreateTaskInput,
  CreateTrashBinInput,
  SecurityCamera,
  Task,
  User,
} from '@/types';

// Aba especial para itens sem andar definido.
const NO_FLOOR = '__no_floor__';
const MAX_PLAN_BYTES = 2 * 1024 * 1024;
// Dimensões do "andar em branco" (sem planta enviada), em unidades do CRS.Simple.
const BLANK_W = 1000;
const BLANK_H = 750;

// Filtro de quais marcadores aparecem na planta (espelha o mapa principal).
type MarkerFilter = 'all' | 'bins' | 'cameras' | 'tasks';

// Item arrastado da lista lateral para ser posicionado no próximo clique.
type Placing = { type: 'bin' | 'camera' | 'task'; id: string };

// Contexto da tarefa que está sendo criada a partir da planta.
type TaskAnchor =
  | { kind: 'point'; posX: number; posY: number }
  | { kind: 'bin'; bin: BuildingBin }
  | { kind: 'camera'; camera: SecurityCamera };

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

function isPlaced(item: { posX: number | null; posY: number | null }): boolean {
  return item.posX !== null && item.posY !== null;
}

export function BuildingViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Deep-link vindo do "Visualizar no mapa" de uma tarefa: foca o marcador,
  // abre o andar certo e (se pendente) oferece o botão "Iniciar tarefa".
  const focusTaskId = searchParams.get('task');
  const floorParam = searchParams.get('floor');
  const startTaskId = searchParams.get('startTask');
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN';
  // Câmeras só são visíveis para ADMIN e SEGURANCA (mesma regra do mapa principal).
  const canViewCameras = user?.role === 'ADMIN' || user?.role === 'SEGURANCA';

  const [building, setBuilding] = useState<BuildingMap | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeFloor, setActiveFloor] = useState<string>('');
  const [markerFilter, setMarkerFilter] = useState<MarkerFilter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Item não posicionado selecionado para receber a próxima posição no clique.
  const [placing, setPlacing] = useState<Placing | null>(null);
  // Modo de clicar na planta para criar uma tarefa avulsa.
  const [picking, setPicking] = useState(false);
  // Tarefa em criação (origem na planta) e seu formulário.
  const [taskAnchor, setTaskAnchor] = useState<TaskAnchor | null>(null);
  // Fluxos da câmera (visualizar imagem / relatar ocorrência), iguais ao mapa.
  const [previewCamera, setPreviewCamera] = useState<SecurityCamera | null>(null);
  const [reportCamera, setReportCamera] = useState<SecurityCamera | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  // Dimensões naturais da imagem da planta (para o mapa manter a proporção real).
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  // Atalho "Iniciar tarefa" (vindo do deep-link de uma tarefa pendente).
  const [startTask, setStartTask] = useState<Task | null>(null);
  const [startingTask, setStartingTask] = useState(false);
  const [startTaskError, setStartTaskError] = useState<string | null>(null);
  // Aviso temporário (3s) exibido ao iniciar uma tarefa pela planta.
  const [startedToast, setStartedToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const data = await api.locations.getBuilding(id);
      setBuilding(data);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar a construção');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // ADMIN precisa da lista de funcionários para atribuir tarefas no formulário.
  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    api.users
      .list()
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  // Rótulos de andar = 1..floorsCount ∪ andares já presentes em qualquer item.
  const floorLabels = useMemo(() => {
    const set = new Set<string>();
    if (building?.floorsCount) {
      for (let i = 1; i <= building.floorsCount; i += 1) set.add(String(i));
    }
    for (const group of building?.floors ?? []) {
      if (group.floor !== null) set.add(group.floor);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  }, [building]);

  const hasNoFloorItems = useMemo(
    () =>
      (building?.floors ?? []).some(
        (g) =>
          g.floor === null &&
          (g.bins.length > 0 || g.cameras.length > 0 || g.tasks.length > 0),
      ),
    [building],
  );

  // Andar da tarefa apontada pelo deep-link (?task=), se ela estiver na planta.
  // Tarefas de lixeira/câmera não viram marcador, então podem não constar aqui —
  // nesse caso caímos no ?floor= da URL.
  const focusTaskFloor = useMemo<string | null | undefined>(() => {
    if (!focusTaskId) return undefined;
    for (const group of building?.floors ?? []) {
      if (group.tasks.some((t) => t.id === focusTaskId)) return group.floor;
    }
    return undefined;
  }, [building, focusTaskId]);

  // Define a aba inicial assim que os andares são conhecidos. Prioriza o andar
  // da tarefa do deep-link, depois o ?floor= da URL, e por fim o primeiro andar.
  useEffect(() => {
    if (activeFloor) return;
    if (focusTaskFloor !== undefined) {
      setActiveFloor(focusTaskFloor === null ? NO_FLOOR : focusTaskFloor);
      return;
    }
    if (floorParam && floorLabels.includes(floorParam)) {
      setActiveFloor(floorParam);
      return;
    }
    if (floorLabels.length > 0) setActiveFloor(floorLabels[0]);
    else if (hasNoFloorItems) setActiveFloor(NO_FLOOR);
  }, [floorLabels, hasNoFloorItems, activeFloor, focusTaskFloor, floorParam]);

  const activeFloorValue = activeFloor === NO_FLOOR ? null : activeFloor;

  const activeGroup = useMemo(
    () => (building?.floors ?? []).find((g) => g.floor === activeFloorValue),
    [building, activeFloorValue],
  );

  // Filtros de tipo aplicados (papel + chip selecionado).
  const showBins = markerFilter === 'all' || markerFilter === 'bins';
  const showCameras = (markerFilter === 'all' || markerFilter === 'cameras') && canViewCameras;
  const showTasks = markerFilter === 'all' || markerFilter === 'tasks';

  const bins = useMemo(() => (showBins ? activeGroup?.bins ?? [] : []), [activeGroup, showBins]);
  const cameras = useMemo(
    () => (showCameras ? activeGroup?.cameras ?? [] : []),
    [activeGroup, showCameras],
  );
  const tasks = useMemo(() => (showTasks ? activeGroup?.tasks ?? [] : []), [activeGroup, showTasks]);

  const placedBins = bins.filter(isPlaced);
  const unplacedBins = bins.filter((b) => !isPlaced(b));
  const placedCameras = cameras.filter(isPlaced);
  const unplacedCameras = cameras.filter((c) => !isPlaced(c));
  const placedTasks = tasks.filter(isPlaced);

  const planImage =
    activeFloorValue !== null ? building?.floorPlans?.[activeFloorValue] ?? null : null;

  // Carrega as dimensões naturais da planta para o mapa usar a proporção real.
  useEffect(() => {
    if (!planImage) {
      setImageSize(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = planImage;
    return () => {
      cancelled = true;
    };
  }, [planImage]);

  // Carrega a tarefa do atalho "Iniciar tarefa" (deep-link ?startTask=). Buscamos
  // por id porque ela pode não estar entre os marcadores deste andar.
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

  // O aviso de "tarefa iniciada" some sozinho após 3 segundos.
  useEffect(() => {
    if (!startedToast) return;
    const timer = setTimeout(() => setStartedToast(null), 3000);
    return () => clearTimeout(timer);
  }, [startedToast]);

  // Inicia a tarefa do atalho (pending → in_progress), some o banner e atualiza
  // os marcadores da planta.
  async function handleStartTask() {
    if (!startTask || startingTask) return;
    setStartingTask(true);
    setStartTaskError(null);
    try {
      await api.tasks.update(startTask.id, { status: 'in_progress' });
      setStartedToast(startTask.title);
      setStartTask(null);
      await load();
    } catch (err: unknown) {
      setStartTaskError(err instanceof ApiError ? err.message : 'Erro ao iniciar a tarefa');
    } finally {
      setStartingTask(false);
    }
  }

  const floorChips = useMemo(() => {
    const chips = floorLabels.map((floor) => ({ value: floor, label: `Andar ${floor}` }));
    if (hasNoFloorItems) chips.push({ value: NO_FLOOR, label: 'Sem andar' });
    return chips;
  }, [floorLabels, hasNoFloorItems]);

  const typeFilters = useMemo(() => {
    const filters: { value: MarkerFilter; label: string }[] = [
      { value: 'all', label: 'Tudo' },
      { value: 'bins', label: 'Lixeiras' },
    ];
    if (canViewCameras) filters.push({ value: 'cameras', label: 'Câmeras' });
    filters.push({ value: 'tasks', label: 'Tarefas' });
    return filters;
  }, [canViewCameras]);

  // Vínculo da ocorrência relatada (usa a própria construção como referência).
  const reportLink = useMemo(
    () => (reportCamera && building ? occurrenceLink(reportCamera, [building], []) : null),
    [reportCamera, building],
  );

  async function persistPosition(
    type: Placing['type'],
    itemId: string,
    posX: number,
    posY: number,
  ) {
    if (activeFloorValue === null) return;
    setActionError(null);
    try {
      const body = { floor: activeFloorValue, posX, posY };
      if (type === 'bin') await api.trashBins.update(itemId, body);
      else if (type === 'camera') await api.cameras.update(itemId, body);
      else await api.tasks.update(itemId, body);
      await load();
    } catch (err: unknown) {
      setActionError(err instanceof ApiError ? err.message : 'Erro ao posicionar o item');
    }
  }

  // Um clique na planta resolve o modo ativo: posicionar um item da lista ou
  // fixar o local de uma nova tarefa.
  function handlePlanClick(posX: number, posY: number) {
    if (placing) {
      void persistPosition(placing.type, placing.id, posX, posY);
      setPlacing(null);
      return;
    }
    if (picking) {
      setPicking(false);
      setFormError(null);
      setTaskAnchor({ kind: 'point', posX, posY });
    }
  }

  function togglePicking() {
    if (!canManage) return;
    setPlacing(null);
    setPicking((prev) => !prev);
  }

  function selectPlacing(type: Placing['type'], itemId: string) {
    if (!canManage) return;
    setPicking(false);
    setPlacing((cur) => (cur && cur.id === itemId ? null : { type, id: itemId }));
  }

  async function handlePlanUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !building || activeFloorValue === null) return;
    if (file.size > MAX_PLAN_BYTES) {
      setActionError('Imagem muito grande (máximo ~2MB).');
      return;
    }
    setActionError(null);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    try {
      await api.locations.update(building.id, {
        floorPlans: { ...(building.floorPlans ?? {}), [activeFloorValue]: dataUrl },
      });
      await load();
    } catch (err: unknown) {
      setActionError(err instanceof ApiError ? err.message : 'Erro ao salvar a planta');
    }
  }

  async function handleAddBin(values: CreateTrashBinInput) {
    setSubmitting(true);
    setFormError(null);
    try {
      await api.trashBins.create(values);
      setAddOpen(false);
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao cadastrar lixeira');
    } finally {
      setSubmitting(false);
    }
  }

  // Cria a tarefa a partir da planta. Só a tarefa "avulsa" (clique na planta)
  // ganha posição própria e vira um marcador de tarefa; tarefas de lixeira/câmera
  // ficam vinculadas ao item (sem marcador duplicado) e seguem para o quadro de
  // tarefas, espelhando o comportamento do mapa principal.
  async function handleTaskSubmit(values: CreateTaskInput) {
    if (!taskAnchor || !building || activeFloorValue === null) return;
    const isPoint = taskAnchor.kind === 'point';
    setSubmitting(true);
    setFormError(null);
    let createdTaskId: string | null = null;
    try {
      const created = await api.tasks.create({
        ...values,
        trashBinId: taskAnchor.kind === 'bin' ? taskAnchor.bin.id : null,
        cameraId: taskAnchor.kind === 'camera' ? taskAnchor.camera.id : null,
        locationId: building.id,
        latitude: null,
        longitude: null,
        // Toda tarefa da construção guarda o andar (para o "Visualizar no mapa"
        // abrir a planta no andar certo); só a tarefa avulsa ganha posição
        // própria e vira marcador na planta.
        floor: activeFloorValue,
        posX: isPoint ? taskAnchor.posX : null,
        posY: isPoint ? taskAnchor.posY : null,
      });
      createdTaskId = created.id;
      setTaskAnchor(null);
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao criar tarefa');
    } finally {
      setSubmitting(false);
    }
    if (!createdTaskId) return;
    // Tarefa avulsa fica na planta (recarrega marcadores); as demais vão para o
    // quadro de tarefas.
    if (isPoint) await load();
    else navigate(`/tasks?task=${createdTaskId}`);
  }

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

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <BackHeader title="Mapa da construção" onBack={() => navigate('/map')} />
        <ErrorState message={error} />
      </div>
    );
  }

  if (!building) return <LoadingState label="Carregando construção..." />;

  const planW = imageSize?.w ?? BLANK_W;
  const planH = imageSize?.h ?? BLANK_H;
  const taskModalTitle =
    taskAnchor?.kind === 'bin'
      ? `Nova tarefa - ${taskAnchor.bin.code}`
      : taskAnchor?.kind === 'camera'
        ? `Nova tarefa - ${taskAnchor.camera.name}`
        : 'Nova tarefa na planta';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <BackHeader
          title={building.name}
          subtitle={building.isBuilding ? 'Mapa da construção' : 'Esta localização não é uma construção'}
          onBack={() => navigate('/map')}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(`/map?location=${building.id}`)}
            >
              <MapPin className="h-3.5 w-3.5" />
              Ver no mapa
            </Button>
          }
        />
        {canManage && activeFloorValue !== null && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant={picking ? 'default' : 'outline'} onClick={togglePicking}>
              <MapPin className="h-4 w-4" />
              {picking ? 'Cancelar seleção' : 'Definir tarefa na planta'}
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Adicionar lixeira
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {floorChips.length > 0 && (
          <FilterChips options={floorChips} value={activeFloor} onChange={setActiveFloor} />
        )}
        <FilterChips options={typeFilters} value={markerFilter} onChange={setMarkerFilter} />
      </div>

      {actionError && <ErrorState message={actionError} />}

      {placing && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          Clique na planta para posicionar o item selecionado.
        </div>
      )}
      {picking && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          Clique na planta para escolher o local da nova tarefa.
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Planta do andar (mapa com zoom/pan) */}
        <div
          className="relative min-h-[460px] overflow-hidden rounded-xl border border-border bg-muted"
          style={{ height: 'calc(100vh - 260px)' }}
        >
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
          {activeFloorValue === null ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Itens sem andar definido. Defina o andar de cada item para posicioná-lo na planta.
            </div>
          ) : (
            <FloorPlanMap
              // Remonta ao trocar de andar ou quando a dimensão da planta muda,
              // para reenquadrar (fitBounds) corretamente.
              key={`${activeFloor}:${planW}x${planH}:${planImage ? 'img' : 'blank'}`}
              imageUrl={planImage}
              width={planW}
              height={planH}
              bins={placedBins}
              cameras={placedCameras}
              tasks={placedTasks}
              focusTaskId={focusTaskId}
              canManage={canManage}
              canViewCameras={canViewCameras}
              interactive={!!placing || picking}
              onPlanClick={handlePlanClick}
              onMove={(type, itemId, posX, posY) => void persistPosition(type, itemId, posX, posY)}
              onCreateTaskForBin={
                canManage ? (bin) => setTaskAnchor({ kind: 'bin', bin }) : undefined
              }
              onCreateTaskForCamera={
                canManage ? (camera) => setTaskAnchor({ kind: 'camera', camera }) : undefined
              }
              onViewCameraImage={canViewCameras ? setPreviewCamera : undefined}
              onSelectTask={(task) => navigate(`/tasks?task=${task.id}`)}
            />
          )}
        </div>

        {/* Painel lateral */}
        <aside className="flex flex-col gap-4">
          {canManage && activeFloorValue !== null && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-2 text-sm font-semibold">Planta do andar</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Envie uma imagem (PNG/JPG, até 2MB) como fundo deste andar.
              </p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">
                <ImagePlus className="h-4 w-4" />
                {planImage ? 'Trocar planta' : 'Enviar planta'}
                <input type="file" accept="image/*" className="hidden" onChange={handlePlanUpload} />
              </label>
            </div>
          )}

          {showBins && (
            <UnplacedPanel
              title="Lixeiras não posicionadas"
              count={unplacedBins.length}
              emptyLabel="Todas as lixeiras deste andar já estão na planta."
            >
              {unplacedBins.map((bin) => (
                <UnplacedItem
                  key={bin.id}
                  active={placing?.id === bin.id}
                  canManage={canManage}
                  color={STATUS_COLOR[bin.status]}
                  icon={<Trash2 className="h-3 w-3 text-white" />}
                  primary={bin.name}
                  secondary={bin.code}
                  onClick={() => selectPlacing('bin', bin.id)}
                />
              ))}
            </UnplacedPanel>
          )}

          {showCameras && (
            <UnplacedPanel
              title="Câmeras não posicionadas"
              count={unplacedCameras.length}
              emptyLabel="Todas as câmeras deste andar já estão na planta."
            >
              {unplacedCameras.map((camera) => (
                <UnplacedItem
                  key={camera.id}
                  active={placing?.id === camera.id}
                  canManage={canManage}
                  color={CAMERA_COLOR[camera.status]}
                  icon={<Camera className="h-3 w-3 text-white" />}
                  primary={camera.name}
                  secondary={camera.code}
                  onClick={() => selectPlacing('camera', camera.id)}
                />
              ))}
            </UnplacedPanel>
          )}

        </aside>
      </div>

      {canManage && (
        <Modal open={addOpen} title="Nova lixeira" onClose={() => setAddOpen(false)}>
          {formError && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          <TrashBinForm
            building={{
              locationId: building.id,
              floors: floorLabels,
              defaultFloor: activeFloorValue ?? undefined,
            }}
            submitting={submitting}
            onCancel={() => setAddOpen(false)}
            onSubmit={handleAddBin}
          />
        </Modal>
      )}

      {canManage && taskAnchor && (
        <Modal open={!!taskAnchor} title={taskModalTitle} onClose={() => setTaskAnchor(null)}>
          {formError && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          <TaskForm
            target={{ kind: 'location', location: building }}
            defaults={taskAnchor.kind === 'bin' ? { assigneeRole: 'LIMPEZA' } : undefined}
            bins={[]}
            users={users}
            submitting={submitting}
            onCancel={() => setTaskAnchor(null)}
            onSubmit={handleTaskSubmit}
          />
        </Modal>
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
    </div>
  );
}

// Captura cliques no mapa para o modo ativo (posicionar item / fixar tarefa).
function PlanClickHandler({
  active,
  onClick,
}: {
  active: boolean;
  onClick: (latlng: L.LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (active) onClick(e.latlng);
    },
  });
  return null;
}

// Centraliza e abre o popup do marcador alvo (tarefa do deep-link). Vive dentro
// do MapContainer para acessar o mapa. O FloorPlanMap é remontado quando a planta
// termina de carregar (muda as dimensões), então o ref pode ainda não existir no
// primeiro tick — por isso tentamos repetidamente até o marcador aparecer.
function PlanFocus({
  targetKey,
  markerRefs,
}: {
  targetKey: string | null;
  markerRefs: React.MutableRefObject<Record<string, L.Marker | null>>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!targetKey) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tryFocus = () => {
      if (cancelled) return;
      const marker = markerRefs.current[targetKey];
      if (marker) {
        // Aproxima e centraliza no marcador, depois abre o popup.
        map.setView(marker.getLatLng(), Math.min(map.getMaxZoom(), Math.max(map.getZoom(), 1)));
        marker.openPopup();
        return;
      }
      if (attempts++ < 30) timer = setTimeout(tryFocus, 100);
    };
    timer = setTimeout(tryFocus, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [targetKey, map, markerRefs]);
  return null;
}

// Mapa da planta usando CRS.Simple: a imagem vira um ImageOverlay e os itens
// (lixeiras, câmeras e tarefas) são marcadores iguais aos do mapa principal.
function FloorPlanMap({
  imageUrl,
  width,
  height,
  bins,
  cameras,
  tasks,
  focusTaskId,
  canManage,
  canViewCameras,
  interactive,
  onPlanClick,
  onMove,
  onCreateTaskForBin,
  onCreateTaskForCamera,
  onViewCameraImage,
  onSelectTask,
}: {
  imageUrl: string | null;
  width: number;
  height: number;
  bins: BuildingBin[];
  cameras: SecurityCamera[];
  tasks: BuildingTask[];
  focusTaskId?: string | null;
  canManage: boolean;
  canViewCameras: boolean;
  interactive: boolean;
  onPlanClick: (posX: number, posY: number) => void;
  onMove: (type: Placing['type'], itemId: string, posX: number, posY: number) => void;
  onCreateTaskForBin?: (bin: BuildingBin) => void;
  onCreateTaskForCamera?: (camera: SecurityCamera) => void;
  onViewCameraImage?: (camera: SecurityCamera) => void;
  onSelectTask: (task: BuildingTask) => void;
}) {
  // Refs dos marcadores de tarefa, para abrir o popup da tarefa do deep-link.
  const markerRefs = useRef<Record<string, L.Marker | null>>({});
  // posX/posY (0-100, a partir do topo-esquerda) <-> coordenadas do CRS.Simple.
  // Em CRS.Simple o "lat" cresce para cima, então invertemos o eixo Y.
  const bounds = useMemo<L.LatLngBoundsExpression>(
    () => [
      [0, 0],
      [height, width],
    ],
    [width, height],
  );

  const toLatLng = (posX: number, posY: number): [number, number] => [
    height - (posY / 100) * height,
    (posX / 100) * width,
  ];

  const toPct = (latlng: L.LatLng) => ({
    posX: clampPercent((latlng.lng / width) * 100),
    posY: clampPercent(((height - latlng.lat) / height) * 100),
  });

  return (
    <MapContainer
      crs={L.CRS.Simple}
      bounds={bounds}
      minZoom={-4}
      maxZoom={4}
      attributionControl={false}
      style={{ height: '100%', width: '100%', cursor: interactive ? 'crosshair' : undefined }}
    >
      {imageUrl && <ImageOverlay url={imageUrl} bounds={bounds} />}
      <PlanClickHandler
        active={interactive}
        onClick={(latlng) => {
          const p = toPct(latlng);
          onPlanClick(p.posX, p.posY);
        }}
      />
      <PlanFocus
        targetKey={focusTaskId ? `task-${focusTaskId}` : null}
        markerRefs={markerRefs}
      />

      {bins.map((bin) => (
        <Marker
          key={`bin-${bin.id}`}
          position={toLatLng(bin.posX ?? 0, bin.posY ?? 0)}
          icon={buildMarkerIcon(STATUS_COLOR[bin.status], MARKER_ICONS.bin)}
        >
          <Popup>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{bin.name}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              <strong>Código:</strong> {bin.code}
            </p>
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              <strong>Status:</strong> {TRASH_BIN_STATUS_LABELS[bin.status]}
            </p>
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              <strong>Preenchimento:</strong>{' '}
              {bin.fillLevel !== null ? `${bin.fillLevel}%` : '—'}
            </p>
            {onCreateTaskForBin && (
              <Button
                type="button"
                size="sm"
                className="mt-2 w-full"
                onClick={() => onCreateTaskForBin(bin)}
              >
                <Plus className="h-3.5 w-3.5" />
                Definir tarefa
              </Button>
            )}
          </Popup>
        </Marker>
      ))}

      {cameras.map((camera) => (
        <Marker
          key={`cam-${camera.id}`}
          position={toLatLng(camera.posX ?? 0, camera.posY ?? 0)}
          icon={buildMarkerIcon(CAMERA_COLOR[camera.status], MARKER_ICONS.camera)}
          draggable={canManage}
          eventHandlers={{
            dragend: (e) => {
              const p = toPct((e.target as L.Marker).getLatLng());
              onMove('camera', camera.id, p.posX, p.posY);
            },
          }}
        >
          <Popup>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{camera.name}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              <strong>Código:</strong> {camera.code}
            </p>
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              <strong>Status:</strong> {CAMERA_STATUS_LABELS[camera.status]}
            </p>
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              <strong>IP:</strong> {camera.ipAddress}
            </p>
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              <strong>Última leitura:</strong> {formatRelativeTime(camera.lastSeenAt)}
            </p>
            {canViewCameras && onViewCameraImage && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 w-full"
                onClick={() => onViewCameraImage(camera)}
              >
                <Eye className="h-3.5 w-3.5" />
                Visualizar imagem
              </Button>
            )}
            {onCreateTaskForCamera && (
              <Button
                type="button"
                size="sm"
                className="mt-2 w-full"
                onClick={() => onCreateTaskForCamera(camera)}
              >
                <Plus className="h-3.5 w-3.5" />
                Definir tarefa
              </Button>
            )}
          </Popup>
        </Marker>
      ))}

      {tasks.map((task) => (
        <Marker
          key={`task-${task.id}`}
          position={toLatLng(task.posX ?? 0, task.posY ?? 0)}
          icon={buildMarkerIcon(TASK_COLOR[task.priority], MARKER_ICONS.task)}
          ref={(ref) => {
            markerRefs.current[`task-${task.id}`] = ref;
          }}
        >
          <Popup>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{task.title}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              <strong>Prioridade:</strong> {TASK_PRIORITY_LABELS[task.priority]}
            </p>
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              <strong>Status:</strong> {TASK_STATUS_LABELS[task.status]}
            </p>
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              <strong>Equipe:</strong> {USER_ROLE_LABELS[task.assigneeRole]}
              {task.assigneeName ? ` — ${task.assigneeName}` : ''}
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2 w-full"
              onClick={() => onSelectTask(task)}
            >
              Ver tarefa
            </Button>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

// Cartão de itens não posicionados (lixeiras/câmeras/tarefas).
function UnplacedPanel({
  title,
  count,
  emptyLabel,
  children,
}: {
  title: string;
  count: number;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold">
        {title} ({count})
      </h2>
      {count === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}
    </div>
  );
}

// Item clicável da lista lateral; ao selecionar entra no modo de posicionamento.
function UnplacedItem({
  active,
  canManage,
  color,
  icon,
  primary,
  secondary,
  onClick,
}: {
  active: boolean;
  canManage: boolean;
  color: string;
  icon: React.ReactNode;
  primary: string;
  secondary: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!canManage}
      onClick={onClick}
      className={
        'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors ' +
        (active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent') +
        (canManage ? '' : ' cursor-default opacity-70')
      }
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        style={{ background: color }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{primary}</span>
        <span className="block truncate font-mono text-xs text-muted-foreground">{secondary}</span>
      </span>
    </button>
  );
}

function BackHeader({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Voltar">
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          {action}
        </div>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
