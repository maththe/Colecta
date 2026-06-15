import { UserRole } from '@prisma/client';

export const EMPLOYEE_ROLES = [
  UserRole.MANUTENCAO,
  UserRole.LIMPEZA,
  UserRole.FINANCEIRO,
  UserRole.SEGURANCA,
  UserRole.FUNCIONARIO,
] as const;

export const TASK_ASSIGNEE_ROLES = [
  UserRole.MANUTENCAO,
  UserRole.LIMPEZA,
  UserRole.FINANCEIRO,
  UserRole.SEGURANCA,
] as const;

export function isEmployeeRole(role: UserRole | undefined): boolean {
  return !!role && (EMPLOYEE_ROLES as readonly UserRole[]).includes(role);
}

export function isTaskAssigneeRole(role: UserRole | undefined): boolean {
  return !!role && (TASK_ASSIGNEE_ROLES as readonly UserRole[]).includes(role);
}
