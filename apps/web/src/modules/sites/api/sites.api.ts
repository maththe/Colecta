import type { CreateSiteInput, Site } from '../types';
import { request } from '@/lib/api/client';

// Escrita (POST/PATCH/DELETE) é restrita ao ADMIN no servidor; o front só expõe
// os botões de edição (contorno/visão) para esse papel.
export const sitesApi = {
  list: () => request<Site[]>('/sites'),
  get: (id: string) => request<Site>(`/sites/${id}`),
  create: (data: CreateSiteInput) =>
    request<Site>('/sites', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateSiteInput>) =>
    request<Site>(`/sites/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<{ id: string }>(`/sites/${id}`, { method: 'DELETE' }),
};
