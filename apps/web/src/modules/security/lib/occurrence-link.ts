import type { Location as ColectaLocation, TrashBin } from '@/types';
import type { SecurityCamera } from '../types';

export interface OccurrenceLink {
  trashBinId: string | null;
  locationId: string | null;
  label: string;
  matched: boolean;
}

export function normalizeMatchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function matchScore(source: string, target: string): number {
  const a = normalizeMatchText(source);
  const b = normalizeMatchText(target);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;

  const sourceTokens = new Set(a.split(/\s+/).filter((token) => token.length > 2));
  const targetTokens = b.split(/\s+/).filter((token) => token.length > 2);
  if (sourceTokens.size === 0 || targetTokens.length === 0) return 0;
  const common = targetTokens.filter((token) => sourceTokens.has(token)).length;
  return common / Math.max(sourceTokens.size, targetTokens.length);
}

export function findLinkedTrashBin(camera: SecurityCamera, bins: TrashBin[]): TrashBin | null {
  if (camera.target.kind !== 'trash_bin') return null;
  const code = normalizeMatchText(camera.target.code);
  return bins.find((bin) => normalizeMatchText(bin.code) === code) ?? null;
}

export function findLinkedLocation(
  camera: SecurityCamera,
  locations: ColectaLocation[],
  linkedBin?: TrashBin | null,
): ColectaLocation | null {
  if (linkedBin) {
    return (
      linkedBin.location ??
      locations.find((location) => location.id === linkedBin.locationId) ??
      null
    );
  }

  const candidates = [
    camera.locationName,
    camera.target.kind === 'location' ? camera.target.name : '',
  ].filter(Boolean);

  let best: { location: ColectaLocation; score: number } | null = null;
  for (const location of locations) {
    const score = Math.max(
      ...candidates.map((candidate) => matchScore(location.name, candidate)),
    );
    if (!best || score > best.score) best = { location, score };
  }

  return best && best.score >= 0.5 ? best.location : null;
}

export function occurrenceLink(
  camera: SecurityCamera,
  locations: ColectaLocation[],
  bins: TrashBin[],
): OccurrenceLink {
  const linkedBin = findLinkedTrashBin(camera, bins);
  if (linkedBin) {
    return {
      trashBinId: linkedBin.id,
      locationId: null,
      label: `${linkedBin.code} - ${linkedBin.name}`,
      matched: true,
    };
  }

  const linkedLocation = findLinkedLocation(camera, locations);
  if (linkedLocation) {
    return {
      trashBinId: null,
      locationId: linkedLocation.id,
      label: linkedLocation.name,
      matched: true,
    };
  }

  return {
    trashBinId: null,
    locationId: null,
    label: camera.locationName,
    matched: false,
  };
}

export function targetText(camera: SecurityCamera): string {
  if (camera.target.kind === 'trash_bin') {
    return `${camera.target.code} ${camera.target.name}`;
  }
  return camera.target.name;
}

export function defaultOccurrenceTitle(camera: SecurityCamera): string {
  if (camera.target.kind === 'trash_bin') {
    return `Ocorrencia - ${camera.target.code}`;
  }
  return `Ocorrencia - ${camera.locationName}`;
}
