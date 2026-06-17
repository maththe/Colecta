import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  type CreateSecurityOccurrenceInput,
  type Location as ColectaLocation,
  type TrashBin,
} from '@/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FilterChips } from '@/components/ui/filter-chips';
import { Input } from '@/components/ui/input';
import type { SecurityCamera } from '../types';
import { occurrenceLink } from '../lib/occurrence-link';
import { isAttentionStatus } from '../lib/camera-status';
import {
  attentionCount,
  cameraMatches,
  groupCamerasByLocation,
  locationWeight,
  statusSummary,
  type StatusFilter,
  type TargetFilter,
} from '../lib/camera-filters';
import {
  ALL_VIEW,
  ATTENTION_VIEW,
  CameraGrid,
  CameraPreviewDialog,
  LocationSidebar,
  ReportOccurrenceDialog,
} from '../components';

const TARGET_FILTERS: { value: TargetFilter; label: string }[] = [
  { value: 'all', label: 'Todos vínculos' },
  { value: 'location', label: 'Posições' },
  { value: 'trash_bin', label: 'Lixeiras' },
];

export function SecurityPage() {
  const navigate = useNavigate();
  const { locationId } = useParams<{ locationId?: string }>();
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

  const sortedLocations = useMemo(
    () =>
      groupCamerasByLocation(cameras ?? []).sort((a, b) => {
        const weight = locationWeight(b) - locationWeight(a);
        if (weight !== 0) return weight;
        return a.name.localeCompare(b.name, 'pt-BR');
      }),
    [cameras],
  );

  const allCameras = useMemo(
    () => sortedLocations.flatMap((location) => location.cameras),
    [sortedLocations],
  );
  const totalAttention = attentionCount(allCameras);

  // Visão atual: localização específica, "Todas" ou "Atenção".
  // Default inteligente: abre em "Atenção" quando há problemas, senão "Todas".
  const defaultKey = totalAttention > 0 ? ATTENTION_VIEW : ALL_VIEW;
  const knownKey =
    locationId &&
    (locationId === ALL_VIEW ||
      locationId === ATTENTION_VIEW ||
      sortedLocations.some((location) => location.id === locationId));
  const selectedKey = knownKey ? (locationId as string) : defaultKey;

  const isAggregated = selectedKey === ALL_VIEW || selectedKey === ATTENTION_VIEW;
  const selectedLocation = sortedLocations.find((location) => location.id === selectedKey) ?? null;

  // Conjunto base da visão (antes dos filtros de status/busca/vínculo).
  const scopeCameras = isAggregated
    ? selectedKey === ATTENTION_VIEW
      ? allCameras.filter((camera) => isAttentionStatus(camera.status))
      : allCameras
    : selectedLocation?.cameras ?? [];

  // Câmeras após busca + vínculo (sem status) — base para os contadores dos chips.
  const chipBase = scopeCameras.filter((camera) =>
    cameraMatches(camera, query, 'all', targetFilter),
  );
  const visibleCameras = chipBase.filter(
    (camera) => statusFilter === 'all' || camera.status === statusFilter,
  );

  const statusFilters: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'Todas', count: chipBase.length },
    { value: 'online', label: 'Online', count: chipBase.filter((c) => c.status === 'online').length },
    { value: 'offline', label: 'Offline', count: chipBase.filter((c) => c.status === 'offline').length },
    {
      value: 'maintenance',
      label: 'Manutenção',
      count: chipBase.filter((c) => c.status === 'maintenance').length,
    },
  ];

  const viewTitle = isAggregated
    ? selectedKey === ATTENTION_VIEW
      ? 'Atenção'
      : 'Todas as câmeras'
    : selectedLocation?.name ?? 'Sem localização';
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
          api.trashBins.list(),
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
  }, []);

  function selectView(key: string) {
    navigate(`/security/${key}`);
  }

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
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Segurança</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitoramento de câmeras vinculadas a posições e lixeiras
          </p>
        </div>
        {totalAttention > 0 && (
          <Button variant="outline" onClick={() => selectView(ATTENTION_VIEW)}>
            <AlertTriangle className="h-4 w-4" />
            {totalAttention} {totalAttention === 1 ? 'câmera com atenção' : 'câmeras com atenção'}
          </Button>
        )}
      </header>

      {camerasError && <ErrorState message={camerasError} />}
      {!cameras && !camerasError && <LoadingState label="Carregando câmeras..." />}

      {cameras && (
      <section className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <LocationSidebar
          locations={sortedLocations}
          selectedKey={selectedKey}
          totalCameras={allCameras.length}
          totalAttention={totalAttention}
          onSelect={selectView}
        />

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por câmera, local, IP, lixeira"
                  className="pl-8"
                />
              </div>
              <div className="flex flex-col gap-2 md:items-end">
                <FilterChips options={statusFilters} value={statusFilter} onChange={setStatusFilter} />
                <FilterChips options={TARGET_FILTERS} value={targetFilter} onChange={setTargetFilter} />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{viewTitle}</h2>
              <p className="text-sm text-muted-foreground">
                {visibleCameras.length}{' '}
                {visibleCameras.length === 1 ? 'câmera exibida' : 'câmeras exibidas'}
              </p>
            </div>
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
              showLocation={isAggregated}
              onPreview={setPreview}
              onReport={openReport}
            />
          )}
        </div>
      </section>
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
