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

/** Papéis que podem ver lixeiras — SEGURANCA é explicitamente excluído. */
export const TRASH_BIN_ROLES: UserRole[] = [
  'ADMIN',
  'MANUTENCAO',
  'LIMPEZA',
  'FINANCEIRO',
  'FUNCIONARIO',
];

/** A equipe de SEGURANCA não deve ver nada relacionado a lixeiras. */
export function canSeeTrashBins(role: UserRole | null | undefined): boolean {
  return role != null && role !== 'SEGURANCA';
}

export interface LoginInput {
  email: string;
  senha: string;
}

export interface LoginResponse {
  access_token: string;
}
