import type { Location } from '@/modules/locations/types';

export type TrashBinStatus =
  | 'active'
  | 'inactive'
  | 'full'
  | 'maintenance'
  | 'offline';

export interface FillForecast {
  etaHours: number;
  etaAt: string;
  slopePerHour: number;
  samples: number;
}

export interface TrashBin {
  id: string;
  name: string;
  code: string;
  /** Recinto ao qual a lixeira pertence (FK obrigatória no back). */
  siteId: string;
  /** Zona temática (FK persistida, recalculada via Turf); null = fora de zona. */
  zoneId: string | null;
  locationId: string | null;
  /** Construção à qual a lixeira pertence; `null` quando está ao ar livre. */
  location: Location | null;
  locationDescription: string | null;
  latitude: number;
  longitude: number;
  capacityLiters: number;
  status: TrashBinStatus;
  fillLevel: number | null;
  batteryLevel: number | null;
  mqttTopic: string | null;
  distanceEmptyCm: number | null;
  distanceFullCm: number | null;
  floor: string | null;
  posX: number | null;
  posY: number | null;
  lastSeenAt: string | null;
  forecast: FillForecast | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrashBinInput {
  name: string;
  code: string;
  locationId?: string | null;
  locationDescription?: string;
  latitude?: number;
  longitude?: number;
  capacityLiters: number;
  mqttTopic?: string | null;
  distanceEmptyCm?: number | null;
  distanceFullCm?: number | null;
  floor?: string | null;
  posX?: number | null;
  posY?: number | null;
}

export const TRASH_BIN_STATUS_LABELS: Record<TrashBinStatus, string> = {
  active: 'Ativa',
  inactive: 'Inativa',
  full: 'Cheia',
  maintenance: 'Manutenção',
  offline: 'Offline',
};

export interface SensorReading {
  id: string;
  trashBinId: string;
  fillLevel: number | null;
  distanceCm: number | null;
  batteryLevel: number | null;
  temperature: number | null;
  latitude: number | null;
  longitude: number | null;
  sensorError: string | null;
  mqttTopic: string | null;
  deviceMillis: number | null;
  payload: unknown;
  receivedAt: string;
  createdAt: string;
}
