import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Extrai o tenantUuid do JWT injetado pelo AuthGuard.
 * Lança ForbiddenException se ausente — nunca devolve undefined,
 * já que `where: { tenantUuid: undefined }` no Prisma resultaria
 * em vazamento entre tenants.
 */
export function getTenantUuid(req: Request): string {
  const user = (req as any).user as { tenantUuid?: string } | undefined;
  const tenantUuid = user?.tenantUuid;
  if (!tenantUuid || typeof tenantUuid !== 'string') {
    throw new ForbiddenException('Tenant não identificado na requisição.');
  }
  return tenantUuid;
}
