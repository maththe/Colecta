import { useEffect, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Building2, Eye, Plus } from 'lucide-react';
import type { Location, SecurityCamera, Task, TrashBin } from '@/types';
import {
  CAMERA_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TRASH_BIN_STATUS_LABELS,
  USER_ROLE_LABELS,
} from '@/types';
import { formatRelativeTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  buildMarkerIcon,
  CAMERA_COLOR,
  LOCATION_COLOR,
  MARKER_ICONS,
  spreadBins,
  STATUS_COLOR,
  TASK_COLOR,
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
  /** Tarefas posicionadas no mapa (com lat/lng próprias), abertas. */
  tasks?: Task[];
  /** Abre os detalhes de uma tarefa a partir do seu marcador. */
  onSelectTask?: (task: Task) => void;
  /** Quando ativo, um clique no mapa dispara `onPickPoint` em vez de navegar. */
  picking?: boolean;
  /** Coordenada escolhida ao clicar no mapa no modo de seleção. */
  onPickPoint?: (latitude: number, longitude: number) => void;
  onCreateTask?: (bin: TrashBin) => void;
  /** Abre o formulário de tarefa para uma câmera (marcador roxo). */
  onCreateTaskForCamera?: (camera: SecurityCamera) => void;
  /** Abre o modal com a imagem ao vivo da câmera. */
  onViewCameraImage?: (camera: SecurityCamera) => void;
  /** Abre o mapa da construção a partir de uma lixeira/posição que é prédio. */
  onViewBuilding?: (locationId: string) => void;
  /** When set, the map flies to this bin and opens its popup. */
  focusBinId?: string | null;
  /** When set, the map flies to this location and opens its popup. */
  focusLocationId?: string | null;
  /** When set, the map flies to this camera and opens its popup. */
  focusCameraId?: string | null;
  /** When set, the map flies to this task marker and opens its popup. */
  focusTaskId?: string | null;
}

// Marker ref keys: bins use their id, locations use a `loc-` prefix e câmeras
// um `cam-` para que os espaços de id nunca colidam no ref compartilhado.
const locationKey = (id: string) => `loc-${id}`;
const cameraKey = (id: string) => `cam-${id}`;
const taskKey = (id: string) => `task-${id}`;

// Captura cliques no mapa apenas quando o modo de seleção está ativo, para
// posicionar uma nova tarefa. Fora desse modo o mapa pan/zoom normalmente.
function MapClickHandler({
  picking,
  onPickPoint,
}: {
  picking?: boolean;
  onPickPoint?: (latitude: number, longitude: number) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = picking ? 'crosshair' : '';
    return () => {
      container.style.cursor = '';
    };
  }, [map, picking]);
  useMapEvents({
    click(event) {
      if (picking) onPickPoint?.(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

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
  tasks = [],
  onSelectTask,
  picking,
  onPickPoint,
  onCreateTask,
  onCreateTaskForCamera,
  onViewCameraImage,
  onViewBuilding,
  focusBinId,
  focusLocationId,
  focusCameraId,
  focusTaskId,
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
    if (focusTaskId) {
      const t = tasks.find((item) => item.id === focusTaskId);
      if (t && t.latitude !== null && t.longitude !== null) {
        return { key: taskKey(t.id), lat: t.latitude, lng: t.longitude };
      }
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
      <MapClickHandler picking={picking} onPickPoint={onPickPoint} />
      {locations.map((location) => (
        <Marker
          key={locationKey(location.id)}
          position={[location.latitude, location.longitude]}
          icon={buildMarkerIcon(LOCATION_COLOR, MARKER_ICONS.building)}
          ref={(ref) => {
            markerRefs.current[locationKey(location.id)] = ref;
          }}
        >
          <Popup>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{location.name}</p>
            {location.description && (
              <p style={{ fontSize: 12, margin: '2px 0' }}>{location.description}</p>
            )}
            {/* Toda Location é construção: a tarefa é definida dentro da planta
                (ver construção), não diretamente no marcador do prédio. */}
            {onViewBuilding && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 w-full"
                onClick={() => onViewBuilding(location.id)}
              >
                <Building2 className="h-3.5 w-3.5" />
                Ver construção
              </Button>
            )}
          </Popup>
        </Marker>
      ))}
      {/* Lixeiras de construção não aparecem no mapa: elas vivem na planta do
          andar (mapa da construção). Aqui só as lixeiras "ao ar livre". */}
      {spreadBins(bins.filter((bin) => !bin.location)).map(({ bin, position }) => (
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
            {onViewCameraImage && (
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
      {tasks.map((task) =>
        task.latitude === null || task.longitude === null ? null : (
          <Marker
            key={taskKey(task.id)}
            position={[task.latitude, task.longitude]}
            icon={buildMarkerIcon(TASK_COLOR[task.priority], MARKER_ICONS.task)}
            ref={(ref) => {
              markerRefs.current[taskKey(task.id)] = ref;
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
              {onSelectTask && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => onSelectTask(task)}
                >
                  Ver tarefa
                </Button>
              )}
            </Popup>
          </Marker>
        ),
      )}
    </MapContainer>
  );
}
