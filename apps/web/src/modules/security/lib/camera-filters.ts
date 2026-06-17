import type { SecurityCamera, SecurityLocation } from '../types';
import { targetText } from './occurrence-link';
import { isAttentionStatus } from './camera-status';

/** Rótulo exibido para câmeras que não pertencem a nenhuma localização. */
export const NO_LOCATION_LABEL = 'Sem localização';

/** "atenção" agrega offline + manutenção; os demais são status diretos. */
export type StatusFilter = 'all' | 'attention' | SecurityCamera['status'];
export type TargetFilter = SecurityCamera['target']['kind'] | 'all';

export interface StatusSummary {
  online: number;
  offline: number;
  maintenance: number;
}

/** Nome amigável da localização da câmera (ou "Sem localização" quando órfã). */
export function cameraLocationLabel(camera: Pick<SecurityCamera, 'locationName'>): string {
  return camera.locationName || NO_LOCATION_LABEL;
}

/**
 * Agrupa câmeras por localização, preservando o formato `SecurityLocation`.
 * Câmeras sem localização caem num grupo "Sem localização" exibido por último.
 */
export function groupCamerasByLocation(cameras: SecurityCamera[]): SecurityLocation[] {
  const locations = new Map<string, SecurityLocation>();

  for (const camera of cameras) {
    const current = locations.get(camera.locationId);
    if (current) {
      current.cameras.push(camera);
    } else {
      locations.set(camera.locationId, {
        id: camera.locationId,
        name: cameraLocationLabel(camera),
        cameras: [camera],
      });
    }
  }

  return Array.from(locations.values()).sort((a, b) => {
    // Grupo "Sem localização" (id vazio) sempre por último.
    if (!a.id) return 1;
    if (!b.id) return -1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

export function statusSummary(cameras: SecurityCamera[]): StatusSummary {
  return {
    online: cameras.filter((camera) => camera.status === 'online').length,
    offline: cameras.filter((camera) => camera.status === 'offline').length,
    maintenance: cameras.filter((camera) => camera.status === 'maintenance').length,
  };
}

/** Quantas câmeras precisam de atenção (offline + manutenção). */
export function attentionCount(cameras: SecurityCamera[]): number {
  return cameras.filter((camera) => isAttentionStatus(camera.status)).length;
}

export function cameraMatches(
  camera: SecurityCamera,
  query: string,
  status: StatusFilter,
  target: TargetFilter,
): boolean {
  const q = query.trim().toLowerCase();
  const matchesQuery =
    !q ||
    camera.name.toLowerCase().includes(q) ||
    camera.code.toLowerCase().includes(q) ||
    camera.locationName.toLowerCase().includes(q) ||
    targetText(camera).toLowerCase().includes(q);
  const matchesStatus =
    status === 'all' ||
    (status === 'attention' ? isAttentionStatus(camera.status) : camera.status === status);
  const matchesTarget = target === 'all' || camera.target.kind === target;

  return matchesQuery && matchesStatus && matchesTarget;
}
