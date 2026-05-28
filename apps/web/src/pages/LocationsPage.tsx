import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { ErrorState, LoadingState, EmptyState } from '../components/States';
import { Modal } from '../components/Modal';
import { LocationForm } from '../components/LocationForm';
import { TrashBinForm } from '../components/TrashBinForm';
import { useAuth } from '../contexts/AuthContext';
import { formatCoord } from '../lib/format';
import type { CreateLocationInput, CreateTrashBinInput, Location, TrashBin } from '../types';
import { Button } from '@/components/ui/button';

type CreateMode = 'location' | 'trash-bin';

type DraftPlacement = {
  latitude: number;
  longitude: number;
  mode: CreateMode;
};

const DEFAULT_CENTER: [number, number] = [-23.5874, -46.6576];

function buildIcon(color: string, size = 22): L.DivIcon {
  const anchor = size / 2;
  return L.divIcon({
    className: 'colecta-placement-marker',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};
      border:3px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
    popupAnchor: [0, -anchor],
  });
}

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
  locations,
  bins,
  center,
  draftPlacement,
  canCreate,
  mode,
  onPick,
}: {
  locations: Location[];
  bins: TrashBin[];
  center: [number, number];
  draftPlacement: DraftPlacement | null;
  canCreate: boolean;
  mode: CreateMode;
  onPick: (placement: DraftPlacement) => void;
}) {
  const occupiedLocationIds = useMemo(
    () => new Set(bins.map((bin) => bin.locationId)),
    [bins],
  );

  const freeLocations = locations.filter((location) => !occupiedLocationIds.has(location.id));

  return (
    <MapContainer
      center={center}
      zoom={15}
      className={canCreate ? 'cursor-crosshair' : undefined}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <MapClickHandler disabled={!canCreate} mode={mode} onPick={onPick} />

      {freeLocations.map((location) => (
        <Marker
          key={location.id}
          position={[location.latitude, location.longitude]}
          icon={buildIcon('#2563eb')}
        >
          <Popup>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{location.name}</p>
            {location.description && (
              <p style={{ fontSize: 12, margin: '2px 0' }}>{location.description}</p>
            )}
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              {formatCoord(location.latitude)}, {formatCoord(location.longitude)}
            </p>
          </Popup>
        </Marker>
      ))}

      {bins.map((bin) => (
        <Marker
          key={bin.id}
          position={[bin.latitude, bin.longitude]}
          icon={buildIcon('#16a34a')}
        >
          <Popup>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{bin.name}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              <strong>Código:</strong> {bin.code}
            </p>
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              {formatCoord(bin.latitude)}, {formatCoord(bin.longitude)}
            </p>
          </Popup>
        </Marker>
      ))}

      {draftPlacement && (
        <Marker
          position={[draftPlacement.latitude, draftPlacement.longitude]}
          icon={buildIcon(draftPlacement.mode === 'location' ? '#2563eb' : '#16a34a', 26)}
        />
      )}
    </MapContainer>
  );
}

export function LocationsPage() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [bins, setBins] = useState<TrashBin[]>([]);
  const [mode, setMode] = useState<CreateMode>('location');
  const [error, setError] = useState<string | null>(null);
  const [draftPlacement, setDraftPlacement] = useState<DraftPlacement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const canCreate = user?.role === 'ADMIN';

  async function loadData() {
    setError(null);
    try {
      const [locationData, binData] = await Promise.all([
        api.locations.list(),
        api.trashBins.list(),
      ]);
      setLocations(locationData);
      setBins(binData);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar dados do mapa');
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const center = useMemo<[number, number]>(() => {
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
  }, [bins, locations]);

  const occupiedLocationIds = useMemo(
    () => new Set(bins.map((bin) => bin.locationId)),
    [bins],
  );

  const sortedLocations = useMemo(
    () =>
      [...(locations ?? [])]
        .filter((location) => !occupiedLocationIds.has(location.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [locations, occupiedLocationIds],
  );

  const sortedBins = useMemo(
    () => [...bins].sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`, 'pt-BR')),
    [bins],
  );

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
      setFormError(err instanceof ApiError ? err.message : 'Erro ao cadastrar posição');
    } finally {
      setSubmitting(false);
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

  const modalTitle = draftPlacement?.mode === 'trash-bin' ? 'Nova lixeira' : 'Nova posição';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Adicionar no mapa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre posições e lixeiras pela coordenada selecionada
          </p>
        </div>

        <div className="flex rounded-lg border border-border bg-card p-1">
          <Button
            type="button"
            variant={mode === 'location' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('location')}
          >
            <MapPin className="h-4 w-4" />
            Posição
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
        </div>
      </div>

      {error && <ErrorState message={error} />}
      {!locations && !error && <LoadingState label="Carregando mapa..." />}

      {locations && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div
            className="min-h-[520px] overflow-hidden rounded-xl border border-border"
            style={{ height: 'calc(100vh - 210px)' }}
          >
            <PlacementMap
              locations={locations}
              bins={bins}
              center={center}
              draftPlacement={draftPlacement}
              canCreate={canCreate}
              mode={mode}
              onPick={setDraftPlacement}
            />
          </div>

          <aside className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Cadastrados</h2>
            </div>

            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              <div className="border-b border-border px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Posições
                  </h3>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                    {sortedLocations.length}
                  </span>
                </div>
                {sortedLocations.length === 0 ? (
                  <EmptyState label="Nenhuma posição cadastrada." className="rounded-lg py-8" />
                ) : (
                  <div className="flex flex-col gap-3">
                    {sortedLocations.map((location) => (
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
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {formatCoord(location.latitude)}, {formatCoord(location.longitude)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {formatCoord(bin.latitude)}, {formatCoord(bin.longitude)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
    </div>
  );
}
