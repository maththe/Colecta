import type {
  AnalyticsSummary,
  CreateLocationInput,
  CreateTaskInput,
  CreateTrashBinInput,
  Location,
  LoginInput,
  LoginResponse,
  Notification,
  ProductivityRow,
  SensorReading,
  Task,
  ThroughputBucket,
  TrashBin,
  User,
} from '../types';
import { clearToken, getToken } from './auth';

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:3333';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text ? safeParseJson(text) : undefined;

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    const message =
      (data && typeof data === 'object' && 'message' in data
        ? Array.isArray((data as { message: unknown }).message)
          ? ((data as { message: string[] }).message).join(', ')
          : String((data as { message: unknown }).message)
        : response.statusText) || `HTTP ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

async function downloadBlob(path: string, fallbackFilename: string): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    if (response.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    throw new ApiError(`HTTP ${response.status}`, response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const filename = filenameFromHeader(response.headers.get('Content-Disposition'))
    ?? fallbackFilename;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function filenameFromHeader(header: string | null): string | null {
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8'')?\"?([^\";]+)\"?/i.exec(header);
  return match ? decodeURIComponent(match[1]) : null;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  auth: {
    login: (data: LoginInput) =>
      request<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  users: {
    me: () => request<User>('/users/me'),
    list: (search?: string) =>
      request<User[]>(`/users/lista${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  },
  trashBins: {
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
  },
  locations: {
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
  },
  tasks: {
    list: () => request<Task[]>('/tasks'),
    get: (id: string) => request<Task>(`/tasks/${id}`),
    create: (data: CreateTaskInput) =>
      request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CreateTaskInput>) =>
      request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) =>
      request<{ id: string }>(`/tasks/${id}`, { method: 'DELETE' }),
  },
  sensorReadings: {
    list: () => request<SensorReading[]>('/sensor-readings'),
    listByBin: (binId: string) =>
      request<SensorReading[]>(`/sensor-readings/trash-bin/${binId}`),
  },
  notifications: {
    list: (onlyUnread = false) =>
      request<Notification[]>(`/notifications${onlyUnread ? '?unread=true' : ''}`),
    unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
    markRead: (id: string) =>
      request<Notification>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () =>
      request<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
  },
  analytics: {
    summary: (range?: { from?: string; to?: string }) => {
      const params = new URLSearchParams();
      if (range?.from) params.set('from', range.from);
      if (range?.to) params.set('to', range.to);
      const qs = params.toString();
      return request<AnalyticsSummary>(`/analytics/summary${qs ? `?${qs}` : ''}`);
    },
    productivity: (range?: { from?: string; to?: string }) => {
      const params = new URLSearchParams();
      if (range?.from) params.set('from', range.from);
      if (range?.to) params.set('to', range.to);
      const qs = params.toString();
      return request<ProductivityRow[]>(`/analytics/productivity${qs ? `?${qs}` : ''}`);
    },
    throughput: (weeks?: number) =>
      request<ThroughputBucket[]>(`/analytics/throughput${weeks ? `?weeks=${weeks}` : ''}`),
  },
  reports: {
    tasksCsv: (range?: { from?: string; to?: string }) => {
      const params = new URLSearchParams();
      if (range?.from) params.set('from', range.from);
      if (range?.to) params.set('to', range.to);
      const qs = params.toString();
      const filename = `colecta-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
      return downloadBlob(`/reports/tasks.csv${qs ? `?${qs}` : ''}`, filename);
    },
  },
};
