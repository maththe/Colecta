import type {
  CreateLocationInput,
  CreateTaskInput,
  CreateTrashBinInput,
  Location,
  LoginInput,
  LoginResponse,
  SensorReading,
  Task,
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
};
