import L from 'leaflet';
import type { SecurityCamera, TaskPriority, TrashBinStatus } from '@/types';

// Cores e ícones compartilhados por todos os mapas (mapa principal e a página
// "Adicionar no mapa"), para que os marcadores sigam exatamente o mesmo padrão
// e não voltem a divergir entre telas.

export const STATUS_COLOR: Record<TrashBinStatus, string> = {
  active: '#16a34a',
  inactive: '#94a3b8',
  full: '#dc2626',
  maintenance: '#d97706',
  offline: '#475569',
};

// Posições (localizações) são marcadas em azul.
export const LOCATION_COLOR = '#2563eb';

// Câmeras de segurança são marcadas em roxo, coloridas por status.
export const CAMERA_COLOR: Record<SecurityCamera['status'], string> = {
  online: '#7c3aed',
  offline: '#dc2626',
  maintenance: '#d97706',
};

// Tarefas posicionadas no mapa: cor por prioridade para destacar urgências.
export const TASK_COLOR: Record<TaskPriority, string> = {
  low: '#0d9488',
  medium: '#0891b2',
  high: '#ea580c',
  urgent: '#dc2626',
};

// Ícones (traçado lucide) usados no centro de cada marcador. Todos compartilham
// o mesmo viewBox 24x24 e são renderizados em branco sobre o círculo colorido.
export const MARKER_ICONS = {
  // Trash2
  bin: `<path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    <line x1="10" x2="10" y1="11" y2="17"/>
    <line x1="14" x2="14" y1="11" y2="17"/>`,
  // Camera
  camera: `<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
    <circle cx="12" cy="13" r="3"/>`,
  // MapPin
  location: `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
    <circle cx="12" cy="10" r="3"/>`,
  // ClipboardList
  task: `<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>`,
} as const;

// Marcador padrão único: círculo colorido (cor = status/categoria) com o ícone
// branco no centro. Lixeiras, posições e câmeras compartilham exatamente o mesmo
// formato — só mudam a cor e o ícone — para um visual consistente no mapa.
export function buildMarkerIcon(color: string, icon: string, size = 28): L.DivIcon {
  const anchor = size / 2;
  const iconSize = Math.round(size * 0.54);
  return L.divIcon({
    className: 'colecta-marker',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      background:${color};
      border:3px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"
        fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        ${icon}
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
    popupAnchor: [0, -anchor - 1],
  });
}

// Nota: `spreadBins()` foi aposentado. Lixeiras ao ar livre têm coordenada
// própria e são renderizadas na posição exata (`[bin.latitude, bin.longitude]`),
// com clustering (react-leaflet-cluster) cuidando da sobreposição visual.
