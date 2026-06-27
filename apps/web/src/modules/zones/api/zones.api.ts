import type { CreateZoneInput, UpdateZoneInput, Zone } from '../types';
import { request } from '@/lib/api/client';

// Escrita (POST/PATCH/DELETE) é restrita ao ADMIN no servidor.
export const zonesApi = {
  list: (siteId?: string) =>
    request<Zone[]>(`/zones${siteId ? `?siteId=${encodeURIComponent(siteId)}` : ''}`),
  get: (id: string) => request<Zone>(`/zones/${id}`),
  create: (data: CreateZoneInput) =>
    request<Zone>('/zones', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateZoneInput) =>
    request<Zone>(`/zones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<{ id: string }>(`/zones/${id}`, { method: 'DELETE' }),
};
