import type { Location } from './location';

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
  locationId: string;
  location: Location;
  locationDescription: string | null;
  latitude: number;
  longitude: number;
  capacityLiters: number;
  status: TrashBinStatus;
  fillLevel: number | null;
  batteryLevel: number | null;
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
}

export const TRASH_BIN_STATUS_LABELS: Record<TrashBinStatus, string> = {
  active: 'Ativa',
  inactive: 'Inativa',
  full: 'Cheia',
  maintenance: 'Manutenção',
  offline: 'Offline',
};
