export type CameraStatus = 'online' | 'offline' | 'maintenance';

export type CameraTarget =
  | {
      kind: 'location';
      id: string;
      name: string;
    }
  | {
      kind: 'trash_bin';
      id: string;
      name: string;
      code: string;
    };

export interface SecurityCamera {
  id: string;
  code: string;
  name: string;
  /** Recinto ao qual a câmera pertence (FK obrigatória no back). */
  siteId: string;
  locationId: string;
  locationName: string;
  target: CameraTarget;
  status: CameraStatus;
  model: string;
  ipAddress: string;
  resolution: string;
  fps: number;
  /** Posição da câmera no mapa. */
  latitude: number;
  longitude: number;
  /** Posicionamento na planta de uma construção (prédio com andares). */
  floor: string | null;
  posX: number | null;
  posY: number | null;
  lastSeenAt: string | null;
  imageUrl: string;
  notes?: string;
}

export interface CreateCameraInput {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  model?: string;
  ipAddress?: string;
  resolution?: string;
  fps?: number;
  status?: CameraStatus;
  imageUrl?: string;
  notes?: string;
  locationId?: string | null;
  trashBinId?: string | null;
  floor?: string | null;
  posX?: number | null;
  posY?: number | null;
}

export interface SecurityLocation {
  id: string;
  name: string;
  cameras: SecurityCamera[];
}

export const CAMERA_STATUS_LABELS: Record<CameraStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  maintenance: 'Manutenção',
};
