import {
  booleanPointInPolygon,
  bbox as turfBbox,
  bboxPolygon,
  mask as turfMask,
} from '@turf/turf';
import L from 'leaflet';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { SiteBoundary } from '../types';

// Web Mercator (EPSG:3857) só é válido até ~±85,05°. Tanto o anel externo da
// máscara quanto os maxBounds clampam a latitude aqui — nunca usamos ±90 literal,
// que projetaria para o infinito e tortaria o recorte.
export const MERCATOR_MAX_LAT = 85.05;

// O boundary do Site pode vir como geometria pura ou embrulhado num Feature.
// Normaliza para a geometria Polygon/MultiPolygon (ou null).
export function boundaryGeometry(boundary: SiteBoundary): Polygon | MultiPolygon | null {
  if (!boundary) return null;
  if (boundary.type === 'Feature') {
    const geom = boundary.geometry;
    return geom && (geom.type === 'Polygon' || geom.type === 'MultiPolygon') ? geom : null;
  }
  if (boundary.type === 'Polygon' || boundary.type === 'MultiPolygon') return boundary;
  return null;
}

// Extrai o primeiro Polygon de uma geometria (o editor trabalha com Polygon
// único; a máscara em si suporta MultiPolygon).
export function firstPolygon(geometry: Polygon | MultiPolygon | null): Polygon | null {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') return geometry;
  const first = geometry.coordinates[0];
  return first ? { type: 'Polygon', coordinates: first } : null;
}

// Converte os anéis de um Polygon GeoJSON ([lng, lat]) para os latlngs do
// Leaflet ([lat, lng]), preservando buracos.
export function polygonToLatLngs(geometry: Polygon): L.LatLngExpression[][] {
  return geometry.coordinates.map((ring) =>
    ring.map(([lng, lat]) => [lat, lng] as [number, number]),
  );
}

// Indica se a coordenada (lat/lng) está dentro do contorno do recinto. Sem
// contorno definido (boundary null), retorna true — não há restrição a aplicar.
// Espelha a validação do backend (geo.util.enforceBoundary).
export function isPointInsideBoundary(
  boundary: SiteBoundary,
  latitude: number,
  longitude: number,
): boolean {
  const geometry = boundaryGeometry(boundary);
  if (!geometry) return true;
  try {
    return booleanPointInPolygon([longitude, latitude], geometry);
  } catch {
    return true; // contorno malformado: não bloqueia o usuário
  }
}

export interface SiteMask {
  /** Máscara "mundo-com-buraco" recortando o recinto (renderizada como GeoJSON). */
  maskFeature: Feature<Polygon | MultiPolygon>;
  /** O contorno do recinto em si, desenhado por cima da máscara como linha. */
  boundaryFeature: Feature<Polygon | MultiPolygon>;
  /** Limites de pan do mapa: bbox do recinto + padding, em Mercator válido. */
  maxBounds: L.LatLngBounds;
}

// Gera a máscara via Turf (winding correto) e os maxBounds a partir do boundary.
//
// O anel externo cobre o mundo inteiro (clampado ao Mercator válido, nunca ±90):
// assim o escurecimento "fora do recinto" nunca termina numa borda visível. Um
// anel do tamanho do bbox virava um retângulo cinza flutuando no meio do mapa
// sempre que a viewport era maior que o recinto. Os maxBounds continuam saindo
// do bbox + padding — são o limite de pan, não o desenho.
//
// Sem boundary válido, retorna null (front trata como "sem recorte/sem limites").
export function buildSiteMask(boundary: SiteBoundary): SiteMask | null {
  const geometry = boundaryGeometry(boundary);
  if (!geometry) return null;

  const [minX, minY, maxX, maxY] = turfBbox(geometry); // [oeste, sul, leste, norte]
  // Padding proporcional ao tamanho do recinto (com piso de ~0,002°), clampando
  // a latitude ao limite do Mercator.
  const padX = Math.max((maxX - minX) * 0.5, 0.002);
  const padY = Math.max((maxY - minY) * 0.5, 0.002);

  const outer = bboxPolygon([-180, -MERCATOR_MAX_LAT, 180, MERCATOR_MAX_LAT]);
  const maskFeature = turfMask(geometry, outer) as Feature<Polygon | MultiPolygon>;
  const maxBounds = L.latLngBounds(
    [clampLat(minY - padY), minX - padX],
    [clampLat(maxY + padY), maxX + padX],
  );

  return {
    maskFeature,
    boundaryFeature: { type: 'Feature', properties: {}, geometry },
    maxBounds,
  };
}

function clampLat(lat: number): number {
  return Math.min(MERCATOR_MAX_LAT, Math.max(-MERCATOR_MAX_LAT, lat));
}
