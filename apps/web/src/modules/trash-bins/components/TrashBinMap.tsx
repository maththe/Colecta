import { useEffect, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Plus } from 'lucide-react';
import type { Location, SecurityCamera, TrashBin } from '@/types';
import { CAMERA_STATUS_LABELS, TRASH_BIN_STATUS_LABELS } from '@/types';
import { formatCoord, formatRelativeTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  buildMarkerIcon,
  CAMERA_COLOR,
  LOCATION_COLOR,
  MARKER_ICONS,
  spreadBins,
  STATUS_COLOR,
} from './map-markers';

// Provider-agnostic map wrapper. The MVP uses Leaflet + OpenStreetMap;
// swapping to Google Maps / Mapbox in the future only requires replacing
// this component's internals — page-level code stays the same.

interface Props {
  bins: TrashBin[];
  center: [number, number];
  /** Posições cadastradas (exibidas como marcadores azuis). */
  locations?: Location[];
  /** Câmeras de segurança (exibidas como marcadores roxos). */
  cameras?: SecurityCamera[];
  onCreateTask?: (bin: TrashBin) => void;
  /** Abre o formulário de tarefa para uma posição (marcador azul). */
  onCreateTaskForLocation?: (location: Location) => void;
  /** Abre o formulário de tarefa para uma câmera (marcador roxo). */
  onCreateTaskForCamera?: (camera: SecurityCamera) => void;
  /** When set, the map flies to this bin and opens its popup. */
  focusBinId?: string | null;
  /** When set, the map flies to this location and opens its popup. */
  focusLocationId?: string | null;
  /** When set, the map flies to this camera and opens its popup. */
  focusCameraId?: string | null;
}

// Marker ref keys: bins use their id, locations use a `loc-` prefix e câmeras
// um `cam-` para que os espaços de id nunca colidam no ref compartilhado.
const locationKey = (id: string) => `loc-${id}`;
const cameraKey = (id: string) => `cam-${id}`;

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
  cameras = [],
  onCreateTask,
  onCreateTaskForLocation,
  onCreateTaskForCamera,
  focusBinId,
  focusLocationId,
  focusCameraId,
}: Props) {
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const focusTarget = (() => {
    if (focusCameraId) {
      const cam = cameras.find((c) => c.id === focusCameraId);
      if (cam) return { key: cameraKey(cam.id), lat: cam.latitude, lng: cam.longitude };
    }
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
          icon={buildMarkerIcon(LOCATION_COLOR, MARKER_ICONS.location)}
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
      {spreadBins(bins).map(({ bin, position }) => (
        <Marker
          key={bin.id}
          position={position}
          icon={buildMarkerIcon(STATUS_COLOR[bin.status], MARKER_ICONS.bin)}
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
      {cameras.map((camera) => (
        <Marker
          key={cameraKey(camera.id)}
          position={[camera.latitude, camera.longitude]}
          icon={buildMarkerIcon(CAMERA_COLOR[camera.status], MARKER_ICONS.camera)}
          ref={(ref) => {
            markerRefs.current[cameraKey(camera.id)] = ref;
          }}
        >
          <Popup>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{camera.name}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Código:</strong> {camera.code}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Status:</strong> {CAMERA_STATUS_LABELS[camera.status]}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Local:</strong> {camera.locationName}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>IP:</strong> {camera.ipAddress}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Última leitura:</strong> {formatRelativeTime(camera.lastSeenAt)}</p>
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
    </MapContainer>
  );
}
