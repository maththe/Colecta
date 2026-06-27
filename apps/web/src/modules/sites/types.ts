import type { Feature, MultiPolygon, Polygon } from 'geojson';

// Modo da camada base do mapa do recinto (espelha o enum SiteBaseMode do back):
// - osm_muted: base "suave" sem clutter (self-host Protomaps .pmtiles; em dev cai
//   para o TileLayer OSM padrão);
// - satellite: imagem de satélite (MapTiler, com chave por env);
// - overlay: mapa do dono sobreposto (Fase 4 — ainda placeholder).
export type SiteBaseMode = 'osm_muted' | 'satellite' | 'overlay';

// Contorno do recinto: GeoJSON Polygon/MultiPolygon (ou um Feature que os
// embrulhe). `null` quando o dono ainda não desenhou — front trata como "sem
// recorte" (sem máscara/maxBounds).
export type SiteBoundary =
  | Polygon
  | MultiPolygon
  | Feature<Polygon | MultiPolygon>
  | null;

// O recinto (Site) é o container espacial de topo: define contorno, camada base
// e a visão inicial do mapa. Toda lixeira/posição/câmera/tarefa pertence a um.
export interface Site {
  id: string;
  name: string;
  boundary: SiteBoundary;
  baseMode: SiteBaseMode;
  centerLat: number | null;
  centerLng: number | null;
  defaultZoom: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSiteInput {
  name: string;
  boundary?: SiteBoundary;
  baseMode?: SiteBaseMode;
  centerLat?: number | null;
  centerLng?: number | null;
  defaultZoom?: number | null;
}

export const SITE_BASE_MODE_LABELS: Record<SiteBaseMode, string> = {
  osm_muted: 'Mapa suave',
  satellite: 'Satélite',
  overlay: 'Mapa do recinto',
};
