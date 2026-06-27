import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { ArrowLeft, Building2, Camera, MapPin, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { ErrorState, LoadingState, EmptyState } from '@/components/States';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LocationForm } from '../components/LocationForm';
import { TrashBinForm } from '@/modules/trash-bins/components/TrashBinForm';
import { CameraForm } from '@/modules/security/components';
import { useAuth } from '@/modules/auth/context/AuthContext';
import type {
  CreateCameraInput,
  CreateLocationInput,
  CreateTrashBinInput,
  Location,
  SecurityCamera,
  Site,
  TrashBin,
  Zone,
} from '@/types';
import { Button } from '@/components/ui/button';
import { SiteMapLayers } from '@/modules/sites/components/SiteMapLayers';
import { isPointInsideBoundary } from '@/modules/sites/lib/site-geo';
import { MapBaseLayer } from '@/modules/trash-bins/components/MapBaseLayer';
import {
  buildMarkerIcon,
  CAMERA_COLOR,
  LOCATION_COLOR,
  MARKER_ICONS,
  STATUS_COLOR,
} from '@/modules/trash-bins/components/map-markers';

type CreateMode = 'location' | 'trash-bin' | 'camera';

type DraftPlacement = {
  latitude: number;
  longitude: number;
  mode: CreateMode;
};

// Item marcado para exclusão, aguardando confirmação no diálogo.
type PendingDelete =
  | { kind: 'location'; item: Location }
  | { kind: 'bin'; item: TrashBin }
  | { kind: 'camera'; item: SecurityCamera };

const DEFAULT_CENTER: [number, number] = [-23.5874, -46.6576];

function MapClickHandler({
  disabled,
  mode,
  onPick,
}: {
  disabled: boolean;
  mode: CreateMode;
  onPick: (placement: DraftPlacement) => void;
}) {
  useMapEvents({
    click(event) {
      if (disabled) return;
      onPick({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
        mode,
      });
    },
  });

  return null;
}

function PlacementMap({
  site,
  zones,
  locations,
  bins,
  cameras,
  center,
  draftPlacement,
  canCreate,
  mode,
  onPick,
}: {
  site: Site | null;
  zones: Zone[];
  locations: Location[];
  bins: TrashBin[];
  cameras: SecurityCamera[];
  center: [number, number];
  draftPlacement: DraftPlacement | null;
  canCreate: boolean;
  mode: CreateMode;
  onPick: (placement: DraftPlacement) => void;
}) {
  return (
    <MapContainer
      center={center}
      zoom={site?.defaultZoom ?? 15}
      className={canCreate ? 'cursor-crosshair' : undefined}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      {/* Recinto: mesma base/máscara/limites/zonas do mapa principal. Sem Site
          carregado (caso raro), cai numa base OSM simples para o mapa não ficar
          em branco. */}
      {site ? (
        <SiteMapLayers site={site} zones={zones} zonesInteractive={false} />
      ) : (
        <MapBaseLayer baseMode="osm_muted" />
      )}
      <MapClickHandler disabled={!canCreate} mode={mode} onPick={onPick} />

      {locations.map((location) => (
        <Marker
          key={location.id}
          position={[location.latitude, location.longitude]}
          icon={buildMarkerIcon(LOCATION_COLOR, MARKER_ICONS.location)}
        >
          <Popup>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{location.name}</p>
            {location.description && (
              <p style={{ fontSize: 12, margin: '2px 0' }}>{location.description}</p>
            )}
          </Popup>
        </Marker>
      ))}

      {/* Lixeiras de construção vivem na planta do andar, não no mapa. As ao ar
          livre aparecem na coordenada exata (sem espalhamento artificial). */}
      {bins
        .filter((bin) => !bin.location)
        .map((bin) => (
        <Marker
          key={bin.id}
          position={[bin.latitude, bin.longitude]}
          icon={buildMarkerIcon(STATUS_COLOR[bin.status], MARKER_ICONS.bin)}
        >
          <Popup>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{bin.name}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              <strong>Código:</strong> {bin.code}
            </p>
          </Popup>
        </Marker>
      ))}

      {cameras.map((camera) => (
        <Marker
          key={camera.id}
          position={[camera.latitude, camera.longitude]}
          icon={buildMarkerIcon(CAMERA_COLOR[camera.status], MARKER_ICONS.camera)}
        >
          <Popup>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{camera.name}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              <strong>Código:</strong> {camera.code}
            </p>
          </Popup>
        </Marker>
      ))}

      {draftPlacement && (
        <Marker
          position={[draftPlacement.latitude, draftPlacement.longitude]}
          icon={
            draftPlacement.mode === 'location'
              ? buildMarkerIcon(LOCATION_COLOR, MARKER_ICONS.location, 34)
              : draftPlacement.mode === 'camera'
                ? buildMarkerIcon(CAMERA_COLOR.online, MARKER_ICONS.camera, 32)
                : buildMarkerIcon(STATUS_COLOR.active, MARKER_ICONS.bin, 32)
          }
        />
      )}
    </MapContainer>
  );
}

export function LocationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [bins, setBins] = useState<TrashBin[]>([]);
  const [cameras, setCameras] = useState<SecurityCamera[]>([]);
  // Recinto e zonas exibidos no mapa (mono-site na v1: primeiro/único Site).
  const [site, setSite] = useState<Site | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [mode, setMode] = useState<CreateMode>('location');
  const [error, setError] = useState<string | null>(null);
  const [draftPlacement, setDraftPlacement] = useState<DraftPlacement | null>(null);
  // Aviso quando o usuário clica fora do recinto (clique não posiciona nada).
  const [pickError, setPickError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const canCreate = user?.role === 'ADMIN';

  async function loadData() {
    setError(null);
    try {
      const [locationData, binData, cameraData, siteData, zoneData] = await Promise.all([
        api.locations.list(),
        api.trashBins.list(),
        api.cameras.list(),
        api.sites.list().then((list) => list[0] ?? null),
        api.zones.list(),
      ]);
      setLocations(locationData);
      setBins(binData);
      setCameras(cameraData);
      setSite(siteData);
      setZones(zoneData);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar dados do mapa');
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const center = useMemo<[number, number]>(() => {
    // Visão definida no recinto tem prioridade (igual ao mapa principal).
    if (site && site.centerLat != null && site.centerLng != null) {
      return [site.centerLat, site.centerLng];
    }
    if (locations && locations.length > 0) {
      const sum = locations.reduce(
        (acc, location) => ({
          lat: acc.lat + location.latitude,
          lng: acc.lng + location.longitude,
        }),
        { lat: 0, lng: 0 },
      );
      return [sum.lat / locations.length, sum.lng / locations.length];
    }

    if (bins.length > 0) {
      const sum = bins.reduce(
        (acc, bin) => ({ lat: acc.lat + bin.latitude, lng: acc.lng + bin.longitude }),
        { lat: 0, lng: 0 },
      );
      return [sum.lat / bins.length, sum.lng / bins.length];
    }

    return DEFAULT_CENTER;
  }, [bins, locations, site]);

  const occupiedLocationIds = useMemo(
    () => new Set(bins.map((bin) => bin.locationId)),
    [bins],
  );

  // Listamos todas as posições (inclusive as que já têm lixeira) para refletir o
  // que aparece no mapa. A exclusão fica desabilitada nas ocupadas, pois o banco
  // impede remover uma posição enquanto houver lixeira vinculada (onDelete: Restrict).
  const sortedLocations = useMemo(
    () =>
      [...(locations ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [locations],
  );

  const sortedBins = useMemo(
    () => [...bins].sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`, 'pt-BR')),
    [bins],
  );

  const sortedCameras = useMemo(
    () =>
      [...cameras].sort((a, b) =>
        `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`, 'pt-BR'),
      ),
    [cameras],
  );

  // Clique no mapa: só posiciona se a coordenada estiver dentro do recinto. O
  // backend reforça a mesma regra (geo.util.enforceBoundary).
  function handlePick(placement: DraftPlacement) {
    if (site && !isPointInsideBoundary(site.boundary, placement.latitude, placement.longitude)) {
      setDraftPlacement(null);
      setPickError('Clique dentro do recinto (área clara do mapa) para adicionar um recurso.');
      return;
    }
    setPickError(null);
    setDraftPlacement(placement);
  }

  function closeModal() {
    setDraftPlacement(null);
    setFormError(null);
  }

  async function handleLocationSubmit(values: CreateLocationInput) {
    if (!draftPlacement || !canCreate) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await api.locations.create(values);
      closeModal();
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao cadastrar construção');
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(target: PendingDelete) {
    if (!canCreate) return;
    setDeleteError(null);
    setPendingDelete(target);
  }

  function cancelDelete() {
    setPendingDelete(null);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!pendingDelete || !canCreate) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (pendingDelete.kind === 'location') {
        await api.locations.remove(pendingDelete.item.id);
      } else if (pendingDelete.kind === 'camera') {
        await api.cameras.remove(pendingDelete.item.id);
      } else {
        await api.trashBins.remove(pendingDelete.item.id);
      }
      setPendingDelete(null);
      await loadData();
    } catch (err: unknown) {
      setDeleteError(err instanceof ApiError ? err.message : 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  }

  async function handleTrashBinSubmit(values: CreateTrashBinInput) {
    if (!draftPlacement || !canCreate) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await api.trashBins.create(values);
      closeModal();
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao cadastrar lixeira');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCameraSubmit(values: CreateCameraInput) {
    if (!draftPlacement || !canCreate) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await api.cameras.create(values);
      closeModal();
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao cadastrar câmera');
    } finally {
      setSubmitting(false);
    }
  }

  const modalTitle =
    draftPlacement?.mode === 'trash-bin'
      ? 'Nova lixeira'
      : draftPlacement?.mode === 'camera'
        ? 'Nova câmera'
        : 'Nova construção';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate('/map')}
            aria-label="Voltar para o mapa"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Adicionar no mapa</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre construções, lixeiras e câmeras pela coordenada selecionada
            </p>
          </div>
        </div>

        <div className="flex rounded-lg border border-border bg-card p-1">
          <Button
            type="button"
            variant={mode === 'location' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('location')}
          >
            <Building2 className="h-4 w-4" />
            Construção
          </Button>
          <Button
            type="button"
            variant={mode === 'trash-bin' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('trash-bin')}
          >
            <Trash2 className="h-4 w-4" />
            Lixeira
          </Button>
          <Button
            type="button"
            variant={mode === 'camera' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('camera')}
          >
            <Camera className="h-4 w-4" />
            Câmera
          </Button>
        </div>
      </div>

      {error && <ErrorState message={error} />}
      {!locations && !error && <LoadingState label="Carregando mapa..." />}

      {pickError && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          {pickError}
        </div>
      )}

      {locations && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div
            className="min-h-[520px] overflow-hidden rounded-xl border border-border"
            style={{ height: 'calc(100vh - 210px)' }}
          >
            <PlacementMap
              site={site}
              zones={zones}
              locations={locations}
              bins={bins}
              cameras={cameras}
              center={center}
              draftPlacement={draftPlacement}
              canCreate={canCreate}
              mode={mode}
              onPick={handlePick}
            />
          </div>

          <aside className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Cadastrados</h2>
            </div>

            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {mode === 'location' && (
              <div className="px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Construções
                  </h3>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                    {sortedLocations.length}
                  </span>
                </div>
                {sortedLocations.length === 0 ? (
                  <EmptyState label="Nenhuma construção cadastrada." className="rounded-lg py-8" />
                ) : (
                  <div className="flex flex-col gap-3">
                    {sortedLocations.map((location) => {
                      const occupied = occupiedLocationIds.has(location.id);
                      return (
                        <div key={location.id} className="flex gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <MapPin className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{location.name}</div>
                            {location.description && (
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {location.description}
                              </p>
                            )}
                            {occupied && (
                              <p className="mt-1 text-xs text-muted-foreground">Com lixeira vinculada</p>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => navigate(`/locations/${location.id}/building`)}
                            >
                              Ver construção
                            </Button>
                          </div>
                          {canCreate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={occupied}
                              onClick={() => requestDelete({ kind: 'location', item: location })}
                              aria-label={
                                occupied
                                  ? `Não é possível excluir ${location.name}: há lixeira vinculada`
                                  : `Excluir construção ${location.name}`
                              }
                              title={occupied ? 'Remova as lixeiras vinculadas antes de excluir' : undefined}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {mode === 'trash-bin' && (
              <div className="px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Lixeiras
                  </h3>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                    {sortedBins.length}
                  </span>
                </div>
                {sortedBins.length === 0 ? (
                  <EmptyState label="Nenhuma lixeira cadastrada." className="rounded-lg py-8" />
                ) : (
                  <div className="flex flex-col gap-3">
                    {sortedBins.map((bin) => (
                      <div key={bin.id} className="flex gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Trash2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                              {bin.code}
                            </span>
                            <span className="truncate text-sm font-semibold">{bin.name}</span>
                          </div>
                        </div>
                        {canCreate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => requestDelete({ kind: 'bin', item: bin })}
                            aria-label={`Excluir lixeira ${bin.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

              {mode === 'camera' && (
              <div className="px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Câmeras
                  </h3>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                    {sortedCameras.length}
                  </span>
                </div>
                {sortedCameras.length === 0 ? (
                  <EmptyState label="Nenhuma câmera cadastrada." className="rounded-lg py-8" />
                ) : (
                  <div className="flex flex-col gap-3">
                    {sortedCameras.map((camera) => (
                      <div key={camera.id} className="flex gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Camera className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                              {camera.code}
                            </span>
                            <span className="truncate text-sm font-semibold">{camera.name}</span>
                          </div>
                        </div>
                        {canCreate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => requestDelete({ kind: 'camera', item: camera })}
                            aria-label={`Excluir câmera ${camera.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {canCreate && draftPlacement && (
        <Modal open={!!draftPlacement} title={modalTitle} onClose={closeModal}>
          {formError && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          {draftPlacement.mode === 'location' ? (
            <LocationForm
              key={`${draftPlacement.latitude}:${draftPlacement.longitude}:location`}
              defaults={{
                latitude: draftPlacement.latitude,
                longitude: draftPlacement.longitude,
              }}
              submitting={submitting}
              onCancel={closeModal}
              onSubmit={handleLocationSubmit}
            />
          ) : draftPlacement.mode === 'camera' ? (
            <CameraForm
              key={`${draftPlacement.latitude}:${draftPlacement.longitude}:camera`}
              defaults={{
                latitude: draftPlacement.latitude,
                longitude: draftPlacement.longitude,
              }}
              submitting={submitting}
              onCancel={closeModal}
              onSubmit={handleCameraSubmit}
            />
          ) : (
            <TrashBinForm
              key={`${draftPlacement.latitude}:${draftPlacement.longitude}:trash-bin`}
              defaults={{
                latitude: draftPlacement.latitude,
                longitude: draftPlacement.longitude,
                capacityLiters: 100,
              }}
              submitting={submitting}
              onCancel={closeModal}
              onSubmit={handleTrashBinSubmit}
            />
          )}
        </Modal>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={
          pendingDelete?.kind === 'bin'
            ? 'Excluir lixeira'
            : pendingDelete?.kind === 'camera'
              ? 'Excluir câmera'
              : 'Excluir construção'
        }
        description={
          pendingDelete &&
          (pendingDelete.kind === 'bin' ? (
            <>
              A lixeira <strong>{pendingDelete.item.name}</strong> será removida do mapa. Esta ação
              não pode ser desfeita.
            </>
          ) : pendingDelete.kind === 'camera' ? (
            <>
              A câmera <strong>{pendingDelete.item.name}</strong> será removida do mapa. Esta ação
              não pode ser desfeita.
            </>
          ) : (
            <>
              A construção <strong>{pendingDelete.item.name}</strong> será removida do mapa. Esta ação
              não pode ser desfeita.
            </>
          ))
        }
        confirmLabel="Excluir"
        destructive
        loading={deleting}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onCancel={cancelDelete}
      />
    </div>
  );
}
