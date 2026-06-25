import type { BuildingMap, CreateLocationInput, Location } from '@/types';
import { request } from '@/lib/api/client';

export const locationsApi = {
  list: () => request<Location[]>('/locations'),
  get: (id: string) => request<Location>(`/locations/${id}`),
  getBuilding: (id: string) => request<BuildingMap>(`/locations/${id}/building`),
  create: (data: CreateLocationInput) =>
    request<Location>('/locations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateLocationInput>) =>
    request<Location>(`/locations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<{ id: string }>(`/locations/${id}`, { method: 'DELETE' }),
};
