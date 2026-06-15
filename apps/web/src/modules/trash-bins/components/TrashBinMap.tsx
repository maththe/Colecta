import { useEffect, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Plus } from 'lucide-react';
import type { Location, TrashBin, TrashBinStatus } from '@/types';
import { TRASH_BIN_STATUS_LABELS } from '@/types';
import { formatCoord, formatRelativeTime } from '@/lib/format';
import { Button } from '@/components/ui/button';

// Provider-agnostic map wrapper. The MVP uses Leaflet + OpenStreetMap;
// swapping to Google Maps / Mapbox in the future only requires replacing
// this component's internals — page-level code stays the same.

const STATUS_COLOR: Record<TrashBinStatus, string> = {
  active: '#16a34a',
  inactive: '#94a3b8',
  full: '#dc2626',
  maintenance: '#d97706',
  offline: '#475569',
};

// Posições (localizações) sem lixeira são marcadas em azul.
const LOCATION_COLOR = '#2563eb';

function buildIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'colecta-marker',
    html: `<div style="
      width:22px;height:22px;border-radius:50%;
      background:${color};
      border:3px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

interface Props {
  bins: TrashBin[];
  center: [number, number];
  /** Posições cadastradas (exibidas como marcadores azuis). */
  locations?: Location[];
  onCreateTask?: (bin: TrashBin) => void;
  /** Abre o formulário de tarefa para uma posição (marcador azul). */
  onCreateTaskForLocation?: (location: Location) => void;
  /** When set, the map flies to this bin and opens its popup. */
  focusBinId?: string | null;
  /** When set, the map flies to this location and opens its popup. */
  focusLocationId?: string | null;
}

// Marker ref keys: bins use their id, locations use a `loc-` prefix so the
// two id spaces never collide in the shared ref map.
const locationKey = (id: string) => `loc-${id}`;

// Drives the camera to a target bin/location and opens its popup when the
// focus id changes. Lives inside MapContainer so it can access the map.
function MapFocus({
  target,
  markerRefs,
}: {
  target: { key: string; lat: number; lng: number } | null;
  markerRefs: React.MutableRefObject<Record<string, L.Marker | null>>;
}) {
  const map = useMap();
  const key = target?.key;
  const lat = target?.lat;
  const lng = target?.lng;
  useEffect(() => {
    if (!key || lat === undefined || lng === undefined) return;
    map.flyTo([lat, lng], 17, { duration: 1 });
    // Open the popup once the fly animation has settled.
    const timer = setTimeout(() => markerRefs.current[key]?.openPopup(), 600);
    return () => clearTimeout(timer);
  }, [key, lat, lng, map, markerRefs]);
  return null;
}

export function TrashBinMap({
  bins,
  center,
  locations = [],
  onCreateTask,
  onCreateTaskForLocation,
  focusBinId,
  focusLocationId,
}: Props) {
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const focusTarget = (() => {
    if (focusBinId) {
      const bin = bins.find((b) => b.id === focusBinId);
      if (bin) return { key: bin.id, lat: bin.latitude, lng: bin.longitude };
    }
    if (focusLocationId) {
      const loc = locations.find((l) => l.id === focusLocationId);
      if (loc) return { key: locationKey(loc.id), lat: loc.latitude, lng: loc.longitude };
    }
    return null;
  })();

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <MapFocus target={focusTarget} markerRefs={markerRefs} />
      {locations.map((location) => (
        <Marker
          key={locationKey(location.id)}
          position={[location.latitude, location.longitude]}
          icon={buildIcon(LOCATION_COLOR)}
          ref={(ref) => {
            markerRefs.current[locationKey(location.id)] = ref;
          }}
        >
          <Popup>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{location.name}</p>
            {location.description && (
              <p style={{ fontSize: 12, margin: '2px 0' }}>{location.description}</p>
            )}
            <p style={{ fontSize: 12, margin: '2px 0' }}>
              {formatCoord(location.latitude)}, {formatCoord(location.longitude)}
            </p>
            {onCreateTaskForLocation && (
              <Button
                type="button"
                size="sm"
                className="mt-2 w-full"
                onClick={() => onCreateTaskForLocation(location)}
              >
                <Plus className="h-3.5 w-3.5" />
                Definir tarefa
              </Button>
            )}
          </Popup>
        </Marker>
      ))}
      {bins.map((bin) => (
        <Marker
          key={bin.id}
          position={[bin.latitude, bin.longitude]}
          icon={buildIcon(STATUS_COLOR[bin.status])}
          ref={(ref) => {
            markerRefs.current[bin.id] = ref;
          }}
        >
          <Popup>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{bin.name}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Código:</strong> {bin.code}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Status:</strong> {TRASH_BIN_STATUS_LABELS[bin.status]}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Preenchimento:</strong>{' '}{bin.fillLevel !== null ? `${bin.fillLevel}%` : '—'}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Bateria:</strong>{' '}{bin.batteryLevel !== null ? `${bin.batteryLevel}%` : '—'}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Última leitura:</strong> {formatRelativeTime(bin.lastSeenAt)}</p>
            {onCreateTask && (
              <Button
                type="button"
                size="sm"
                className="mt-2 w-full"
                onClick={() => onCreateTask(bin)}
              >
                <Plus className="h-3.5 w-3.5" />
                Definir tarefa
              </Button>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
