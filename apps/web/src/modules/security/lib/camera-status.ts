import type { CameraStatus } from '../types';

/** Cor do "dot" indicador de status da câmera. */
export const STATUS_DOT: Record<CameraStatus, string> = {
  online: 'bg-primary',
  offline: 'bg-destructive',
  maintenance: 'bg-amber-500',
};

/** Variante do Badge por status. */
export const STATUS_BADGE: Record<CameraStatus, 'success' | 'destructive' | 'warning'> = {
  online: 'success',
  offline: 'destructive',
  maintenance: 'warning',
};

/**
 * Cor da borda-esquerda de acento do card, no mesmo padrão visual do TaskCard
 * (apps/web/src/modules/tasks/components/TaskCard.tsx).
 */
export const STATUS_ACCENT: Record<CameraStatus, string> = {
  online: 'border-l-primary',
  offline: 'border-l-destructive',
  maintenance: 'border-l-amber-500',
};

/** Um status é considerado "problema" (precisa de atenção) quando não está online. */
export function isAttentionStatus(status: CameraStatus): boolean {
  return status !== 'online';
}
