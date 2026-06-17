import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  type CreateSecurityOccurrenceInput,
  type Location as ColectaLocation,
  type TrashBin,
} from '@/types';
import { canSeeTrashBins } from '@/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FilterChips } from '@/components/ui/filter-chips';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/modules/auth/context/AuthContext';
import type { SecurityCamera } from '../types';
import { occurrenceLink } from '../lib/occurrence-link';
import {
  attentionCount,
  cameraMatches,
  statusSummary,
  type StatusFilter,
  type TargetFilter,
} from '../lib/camera-filters';
import {
  CameraGrid,
  CameraPreviewDialog,
  ReportOccurrenceDialog,
} from '../components';

const TARGET_FILTERS: { value: TargetFilter; label: string }[] = [
  { value: 'all', label: 'Todos vínculos' },
  { value: 'location', label: 'Posições' },
  { value: 'trash_bin', label: 'Lixeiras' },
];

export function SecurityPage() {
  const { user } = useAuth();
  // SEGURANCA não vê nada relacionado a lixeiras: sem filtro/menção de lixeira
  // e sem buscar o endpoint de lixeiras (que responde 403 para o papel).
  const canSeeBins = canSeeTrashBins(user?.role);
  const targetFilters = useMemo(
    () =>
      canSeeBins ? TARGET_FILTERS : TARGET_FILTERS.filter((f) => f.value !== 'trash_bin'),
    [canSeeBins],
  );
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all');
  const [preview, setPreview] = useState<SecurityCamera | null>(null);
  const [reportCamera, setReportCamera] = useState<SecurityCamera | null>(null);
  const [cameras, setCameras] = useState<SecurityCamera[] | null>(null);
  const [camerasError, setCamerasError] = useState<string | null>(null);
  const [locations, setLocations] = useState<ColectaLocation[]>([]);
  const [bins, setBins] = useState<TrashBin[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);

  const allCameras = useMemo(
    () =>
      [...(cameras ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [cameras],
  );
  // Câmeras após busca + vínculo (sem status) — base para os contadores dos chips.
  const chipBase = allCameras.filter((camera) =>
    cameraMatches(camera, query, 'all', targetFilter),
  );
  const visibleCameras = chipBase.filter((camera) =>
    cameraMatches(camera, query, statusFilter, targetFilter),
  );

  const statusFilters: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'Todas', count: chipBase.length },
    { value: 'attention', label: 'Atenção', count: attentionCount(chipBase) },
    { value: 'online', label: 'Online', count: chipBase.filter((c) => c.status === 'online').length },
    { value: 'offline', label: 'Offline', count: chipBase.filter((c) => c.status === 'offline').length },
    {
      value: 'maintenance',
      label: 'Manutenção',
      count: chipBase.filter((c) => c.status === 'maintenance').length,
    },
  ];

  const visibleSummary = statusSummary(visibleCameras);
  const reportLink = reportCamera ? occurrenceLink(reportCamera, locations, bins) : null;

  useEffect(() => {
    let cancelled = false;

    async function loadCameras() {
      setCamerasError(null);
      try {
        const cameraData = await api.cameras.list();
        if (cancelled) return;
        setCameras(cameraData);
      } catch (err: unknown) {
        if (cancelled) return;
        setCameras([]);
        setCamerasError(err instanceof ApiError ? err.message : 'Falha ao carregar câmeras');
      }
    }

    async function loadReferences() {
      setReferenceError(null);
      try {
        const [locationData, binData] = await Promise.all([
          api.locations.list(),
          canSeeBins ? api.trashBins.list() : Promise.resolve<TrashBin[]>([]),
        ]);
        if (cancelled) return;
        setLocations(locationData);
        setBins(binData);
      } catch {
        if (cancelled) return;
        setReferenceError(
          'Não foi possível carregar os vínculos reais. A tarefa será criada com os dados da câmera.',
        );
      }
    }

    void loadCameras();
    void loadReferences();

    return () => {
      cancelled = true;
    };
  }, [canSeeBins]);

  function openReport(camera: SecurityCamera) {
    setReportCamera(camera);
    setReportError(null);
  }

  function openReportFromPreview(camera: SecurityCamera) {
    setPreview(null);
    openReport(camera);
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

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Segurança</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canSeeBins
            ? 'Monitoramento de câmeras vinculadas a posições e lixeiras'
            : 'Monitoramento de câmeras vinculadas a posições'}
        </p>
      </header>

      {camerasError && <ErrorState message={camerasError} />}
      {!cameras && !camerasError && <LoadingState label="Carregando câmeras..." />}

      {cameras && (
        <>
          <Card>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    canSeeBins
                      ? 'Buscar por câmera, local, IP, lixeira'
                      : 'Buscar por câmera, local, IP'
                  }
                  className="pl-8"
                />
              </div>
              <div className="flex flex-col gap-2 md:items-end">
                <FilterChips options={statusFilters} value={statusFilter} onChange={setStatusFilter} />
                {canSeeBins && (
                  <FilterChips options={targetFilters} value={targetFilter} onChange={setTargetFilter} />
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {visibleCameras.length}{' '}
              {visibleCameras.length === 1 ? 'câmera exibida' : 'câmeras exibidas'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">{visibleSummary.online} online</Badge>
              {visibleSummary.maintenance > 0 && (
                <Badge variant="warning">{visibleSummary.maintenance} manutenção</Badge>
              )}
              {visibleSummary.offline > 0 && (
                <Badge variant="destructive">{visibleSummary.offline} offline</Badge>
              )}
            </div>
          </div>

          {visibleCameras.length === 0 ? (
            <EmptyState label="Nenhuma câmera atende aos filtros selecionados." />
          ) : (
            <CameraGrid
              cameras={visibleCameras}
              showLocation
              onPreview={setPreview}
              onReport={openReport}
            />
          )}
        </>
      )}

      <CameraPreviewDialog
        camera={preview}
        onClose={() => setPreview(null)}
        onReport={openReportFromPreview}
      />
      <ReportOccurrenceDialog
        camera={reportCamera}
        link={reportLink}
        referenceError={referenceError}
        submitting={reporting}
        error={reportError}
        onClose={closeReport}
        onSubmit={handleReportSubmit}
      />
    </div>
  );
}
