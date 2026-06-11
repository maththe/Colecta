import type { Notification } from '@/types';
import { request } from '@/lib/api/client';

export const notificationsApi = {
  list: (onlyUnread = false) =>
    request<Notification[]>(`/notifications${onlyUnread ? '?unread=true' : ''}`),
  unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () =>
    request<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
};
