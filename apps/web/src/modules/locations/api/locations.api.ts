import type { CreateLocationInput, Location } from '@/types';
import { request } from '@/lib/api/client';

export const locationsApi = {
  list: () => request<Location[]>('/locations'),
  get: (id: string) => request<Location>(`/locations/${id}`),
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
