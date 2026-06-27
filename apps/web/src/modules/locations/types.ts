import type { TrashBinStatus } from '@/modules/trash-bins/types';
import type { SecurityCamera } from '@/modules/security/types';
import type { TaskPriority, TaskStatus } from '@/modules/tasks/types';
import type { UserRole } from '@/modules/auth/types';

export interface Location {
  id: string;
  name: string;
  /** Recinto ao qual a construção pertence (FK obrigatória no back). */
  siteId: string;
  description: string | null;
  latitude: number;
  longitude: number;
  floorsCount: number | null;
  /** Mapa "andar -> data URL da imagem da planta". */
  floorPlans: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationInput {
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  floorsCount?: number | null;
  floorPlans?: Record<string, string> | null;
}

/** Lixeira simplificada retornada pelo mapa da construção. */
export interface BuildingBin {
  id: string;
  name: string;
  code: string;
  status: TrashBinStatus;
  fillLevel: number | null;
  floor: string | null;
  posX: number | null;
  posY: number | null;
}

/** Tarefa simplificada (posicionada na planta) retornada pelo mapa da construção. */
export interface BuildingTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeRole: UserRole;
  assigneeName: string | null;
  floor: string | null;
  posX: number | null;
  posY: number | null;
}

/** Um andar da construção, com os três tipos de marcador agrupados. */
export interface BuildingFloor {
  floor: string | null;
  bins: BuildingBin[];
  cameras: SecurityCamera[];
  tasks: BuildingTask[];
}

/** Resposta de GET /locations/:id/building. */
export interface BuildingMap extends Location {
  floors: BuildingFloor[];
}
