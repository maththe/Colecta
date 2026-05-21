import type {
  CreateTaskInput,
  CreateTrashBinInput,
  SensorReading,
  Task,
  TrashBin,
} from '../types';

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
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text ? safeParseJson(text) : undefined;

  if (!response.ok) {
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
