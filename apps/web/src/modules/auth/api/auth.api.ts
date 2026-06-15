import type { LoginInput, LoginResponse, User } from '@/types';
import { request } from '@/lib/api/client';

export const authApi = {
  login: (data: LoginInput) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const usersApi = {
  me: () => request<User>('/users/me'),
  list: (search?: string) =>
    request<User[]>(`/users/lista${search ? `?search=${encodeURIComponent(search)}` : ''}`),
};
