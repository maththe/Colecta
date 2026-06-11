export type UserRole = 'ADMIN' | 'FUNCIONARIO';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface LoginInput {
  email: string;
  senha: string;
}

export interface LoginResponse {
  access_token: string;
}
