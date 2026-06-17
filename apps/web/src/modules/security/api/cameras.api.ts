import { request } from '@/lib/api/client';
import type { SecurityCamera } from '../types';

export const camerasApi = {
  list: () => request<SecurityCamera[]>('/cameras'),
  get: (id: string) => request<SecurityCamera>(`/cameras/${id}`),
};
