import type { CreateTaskInput, Task } from '../../types';
import { request } from './client';

export const tasksApi = {
  list: () => request<Task[]>('/tasks'),
  get: (id: string) => request<Task>(`/tasks/${id}`),
  create: (data: CreateTaskInput) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateTaskInput>) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<{ id: string }>(`/tasks/${id}`, { method: 'DELETE' }),
};
