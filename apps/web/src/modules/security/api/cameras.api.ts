import { request } from '@/lib/api/client';
import type { CreateCameraInput, SecurityCamera } from '../types';

export const camerasApi = {
  list: () => request<SecurityCamera[]>('/cameras'),
  get: (id: string) => request<SecurityCamera>(`/cameras/${id}`),
  create: (data: CreateCameraInput) =>
    request<SecurityCamera>('/cameras', { method: 'POST', body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<{ id: string }>(`/cameras/${id}`, { method: 'DELETE' }),
};
