import type { SecurityCamera, SecurityLocation } from '../types';
import { targetText } from './occurrence-link';
import { isAttentionStatus } from './camera-status';

export type StatusFilter = SecurityCamera['status'] | 'all';
export type TargetFilter = SecurityCamera['target']['kind'] | 'all';

export interface StatusSummary {
  online: number;
  offline: number;
  maintenance: number;
}

/** Agrupa câmeras por localização, preservando o formato `SecurityLocation`. */
export function groupCamerasByLocation(cameras: SecurityCamera[]): SecurityLocation[] {
  const locations = new Map<string, SecurityLocation>();

  for (const camera of cameras) {
    const current = locations.get(camera.locationId);
    if (current) {
      current.cameras.push(camera);
    } else {
      locations.set(camera.locationId, {
        id: camera.locationId,
        name: camera.locationName,
        cameras: [camera],
      });
    }
  }

  return Array.from(locations.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
}

export function statusSummary(cameras: SecurityCamera[]): StatusSummary {
  return {
    online: cameras.filter((camera) => camera.status === 'online').length,
    offline: cameras.filter((camera) => camera.status === 'offline').length,
    maintenance: cameras.filter((camera) => camera.status === 'maintenance').length,
  };
}

/** Quantas câmeras da localização precisam de atenção (offline + manutenção). */
export function attentionCount(cameras: SecurityCamera[]): number {
  return cameras.filter((camera) => isAttentionStatus(camera.status)).length;
}

export function latestSeen(cameras: SecurityCamera[]): string | null {
  return (
    cameras
      .map((camera) => camera.lastSeenAt)
      .filter((value): value is string => !!value)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
  );
}

/** Peso para ordenar localizações: prioriza as com mais problemas. */
export function locationWeight(location: SecurityLocation): number {
  const summary = statusSummary(location.cameras);
  return summary.offline * 3 + summary.maintenance * 2;
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
  const matchesStatus = status === 'all' || camera.status === status;
  const matchesTarget = target === 'all' || camera.target.kind === target;

  return matchesQuery && matchesStatus && matchesTarget;
}
