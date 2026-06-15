export type UserRole =
  | 'ADMIN'
  | 'MANUTENCAO'
  | 'LIMPEZA'
  | 'FINANCEIRO'
  | 'SEGURANCA'
  | 'FUNCIONARIO';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  MANUTENCAO: 'Manutenção',
  LIMPEZA: 'Limpeza',
  FINANCEIRO: 'Financeiro',
  SEGURANCA: 'Segurança',
  FUNCIONARIO: 'Funcionário',
};

export const EMPLOYEE_USER_ROLES: UserRole[] = [
  'MANUTENCAO',
  'LIMPEZA',
  'FINANCEIRO',
  'SEGURANCA',
];

export interface LoginInput {
  email: string;
  senha: string;
}

export interface LoginResponse {
  access_token: string;
}
