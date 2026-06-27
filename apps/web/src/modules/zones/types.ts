import type { Feature, MultiPolygon, Polygon } from 'geojson';

// Polígono da zona em GeoJSON (Polygon/MultiPolygon, ou Feature que os embrulhe).
export type ZonePolygon =
  | Polygon
  | MultiPolygon
  | Feature<Polygon | MultiPolygon>;

// Zona temática dentro de um recinto (Site). O pertencimento da lixeira à zona é
// FK persistida (`TrashBin.zoneId`); o polígono só sugere/recalcula no back.
export interface Zone {
  id: string;
  siteId: string;
  name: string;
  category: string | null;
  color: string | null;
  polygon: ZonePolygon;
  createdAt: string;
  updatedAt: string;
}

export interface CreateZoneInput {
  siteId: string;
  name: string;
  category?: string | null;
  color?: string | null;
  polygon: ZonePolygon;
}

// Atualização não muda o Site da zona (ela nasce dentro de um recinto).
export type UpdateZoneInput = Partial<Omit<CreateZoneInput, 'siteId'>>;
