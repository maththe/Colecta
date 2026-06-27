import L from 'leaflet';
import { boundaryGeometry } from '@/modules/sites/lib/site-geo';
import type { ZonePolygon } from '../types';

// Paleta padrão para zonas sem cor definida (determinística pelo índice).
export const DEFAULT_ZONE_COLORS = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#dc2626',
  '#0891b2',
  '#db2777',
  '#65a30d',
];

export function zoneColor(color: string | null, index: number): string {
  return color || DEFAULT_ZONE_COLORS[index % DEFAULT_ZONE_COLORS.length];
}

function ringsToLatLngs(rings: number[][][]): L.LatLngExpression[][] {
  return rings.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]));
}

// Converte o polígono GeoJSON da zona ([lng, lat]) para os positions do Leaflet
// ([lat, lng]), sempre no formato multi-polígono-com-buracos aceito pelo
// componente Polygon do react-leaflet.
export function zoneToPositions(polygon: ZonePolygon): L.LatLngExpression[][][] {
  const geometry = boundaryGeometry(polygon);
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [ringsToLatLngs(geometry.coordinates)];
  return geometry.coordinates.map(ringsToLatLngs);
}
