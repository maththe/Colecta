import type { UserRole } from '@/modules/auth/types';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  trashBinId: string | null;
  trashBin: { id: string; name: string; code: string } | null;
  locationId: string | null;
  location: { id: string; name: string; latitude: number; longitude: number } | null;
  cameraId: string | null;
  // Coordenadas próprias quando a tarefa foi posicionada livremente no mapa.
  latitude: number | null;
  longitude: number | null;
  assigneeRole: UserRole;
  assigneeName: string | null;
  dueDate: string | null;
  startedAt: string | null;
  startedBy: { id: string; name: string } | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  trashBinId?: string | null;
  locationId?: string | null;
  cameraId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  assigneeRole: UserRole;
  assigneeName?: string | null;
  dueDate?: string | null;
}

export interface CreateSecurityOccurrenceInput {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  trashBinId?: string | null;
  locationId?: string | null;
  cameraId?: string | null;
  cameraCode: string;
  cameraName: string;
  locationName: string;
  targetLabel?: string | null;
  dueDate?: string | null;
}

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
