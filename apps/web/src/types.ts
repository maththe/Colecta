export type TrashBinStatus =
  | 'active'
  | 'inactive'
  | 'full'
  | 'maintenance'
  | 'offline';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TrashBin {
  id: string;
  name: string;
  code: string;
  locationDescription: string | null;
  latitude: number;
  longitude: number;
  capacityLiters: number;
  status: TrashBinStatus;
  fillLevel: number | null;
  batteryLevel: number | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrashBinInput {
  name: string;
  code: string;
  locationDescription?: string;
  latitude: number;
  longitude: number;
  capacityLiters: number;
}

export interface SensorReading {
  id: string;
  trashBinId: string;
  fillLevel: number;
  batteryLevel: number | null;
  temperature: number | null;
  latitude: number | null;
  longitude: number | null;
  payload: unknown;
  receivedAt: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  trashBinId: string | null;
  trashBin: { id: string; name: string; code: string } | null;
  assigneeName: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  trashBinId?: string | null;
  assigneeName?: string | null;
  dueDate?: string | null;
}

export const TRASH_BIN_STATUS_LABELS: Record<TrashBinStatus, string> = {
  active: 'Ativa',
  inactive: 'Inativa',
  full: 'Cheia',
  maintenance: 'Manutenção',
  offline: 'Offline',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  done: 'Concluída',
  cancelled: 'Cancelada',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};
