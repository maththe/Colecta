import type { CreateTrashBinInput, SensorReading, TrashBin } from '@/types';
import { request } from '@/lib/api/client';

export const trashBinsApi = {
  list: () => request<TrashBin[]>('/trash-bins'),
  get: (id: string) => request<TrashBin>(`/trash-bins/${id}`),
  create: (data: CreateTrashBinInput) =>
    request<TrashBin>('/trash-bins', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateTrashBinInput>) =>
    request<TrashBin>(`/trash-bins/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<{ id: string }>(`/trash-bins/${id}`, { method: 'DELETE' }),
};

export const sensorReadingsApi = {
  list: () => request<SensorReading[]>('/sensor-readings'),
  listByBin: (binId: string) =>
    request<SensorReading[]>(`/sensor-readings/trash-bin/${binId}`),
};
