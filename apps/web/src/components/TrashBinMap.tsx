import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import type { TrashBin, TrashBinStatus } from '../types';
import { TRASH_BIN_STATUS_LABELS } from '../types';
import { formatRelativeTime } from '../lib/format';

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
}

export function TrashBinMap({ bins, center }: Props) {
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
      {bins.map((bin) => (
        <Marker
          key={bin.id}
          position={[bin.latitude, bin.longitude]}
          icon={buildIcon(STATUS_COLOR[bin.status])}
        >
          <Popup>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{bin.name}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Código:</strong> {bin.code}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Status:</strong> {TRASH_BIN_STATUS_LABELS[bin.status]}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Preenchimento:</strong>{' '}{bin.fillLevel !== null ? `${bin.fillLevel}%` : '—'}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Bateria:</strong>{' '}{bin.batteryLevel !== null ? `${bin.batteryLevel}%` : '—'}</p>
            <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Última leitura:</strong> {formatRelativeTime(bin.lastSeenAt)}</p>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
