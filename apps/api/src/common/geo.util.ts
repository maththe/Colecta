import { BadRequestException } from '@nestjs/common';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import type { Prisma, PrismaClient } from '@prisma/client';

// Ponto único de resolução de pertencimento espacial (belonging).
//
// Regra (ver docs/plano-recinto.md, "Invariante de belonging INDOOR"):
//  - INDOOR (locationId presente): herda `location.siteId`. Um `siteId` divergente
//    no payload é ERRO (não há coordenada própria; a construção é a fonte única).
//  - OUTDOOR (sem locationId): `siteId` explícito → Turf (point-in-polygon sobre os
//    boundaries do tenant) → Site default do tenant.
//  - Sem coord nem pai (ex.: ocorrência de câmera sem posição): Site default.
//
// `siteId` é NOT NULL nas 4 entidades espaciais; esta função garante a invariante
// para TODO writer (controllers, upsertAutoTask, seed, criações internas).

// Subconjunto do PrismaClient que esta util precisa — aceita tanto o PrismaService
// (Nest) quanto o `new PrismaClient()` do seed.
type PrismaLike = Pick<PrismaClient, 'site' | 'location' | 'trashBin' | 'camera' | 'zone'>;

export interface ResolveSiteInput {
  tenantUuid: string;
  /** Construção (prédio) à qual o recurso pertence; define belonging indoor. */
  locationId?: string | null;
  /** Site informado explicitamente no payload (outdoor). */
  siteId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /**
   * Quando true, rejeita uma coordenada que caia FORA do contorno do Site
   * resolvido (recursos só podem ser criados dentro do recinto). Aplicado nos
   * writers voltados ao usuário; fluxos internos (seed, auto-tarefa) não usam.
   * Sem contorno definido (boundary null), não há restrição.
   */
  enforceBoundary?: boolean;
}

/** GeoJSON Polygon/MultiPolygon como guardado em `Site.boundary` (Json). */
type BoundaryGeometry =
  | GeoJSON.Polygon
  | GeoJSON.MultiPolygon
  | GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

interface SiteWithBoundary {
  id: string;
  boundary: Prisma.JsonValue | null;
}

/**
 * Resolve o `siteId` de um recurso espacial aplicando a invariante de belonging.
 * Lança `BadRequestException` quando o estado é inconsistente (construção/site
 * inexistente, ou siteId divergente do da construção em recurso indoor).
 */
export async function resolveSiteId(
  prisma: PrismaLike,
  input: ResolveSiteInput,
): Promise<string> {
  const { tenantUuid, locationId, siteId, latitude, longitude, enforceBoundary } = input;

  // INDOOR: herda o Site da construção; rejeita divergência. Sem coordenada
  // própria, não há o que validar contra o contorno (a construção já está dentro).
  if (locationId) {
    const location = await prisma.location.findFirst({
      where: { id: locationId, tenantUuid },
      select: { siteId: true },
    });
    if (!location) {
      throw new BadRequestException(`Location ${locationId} not found`);
    }
    if (siteId && siteId !== location.siteId) {
      throw new BadRequestException(
        'Recurso indoor herda o Site da construção (locationId); ' +
          'não envie um siteId divergente.',
      );
    }
    return location.siteId;
  }

  // OUTDOOR com siteId explícito: valida que pertence ao tenant.
  let resolvedId: string;
  if (siteId) {
    const site = await prisma.site.findFirst({
      where: { id: siteId, tenantUuid },
      select: { id: true },
    });
    if (!site) throw new BadRequestException(`Site ${siteId} not found`);
    resolvedId = site.id;
  } else {
    // OUTDOOR sem siteId: Turf por coordenada → Site default (o mais antigo).
    const sites = await prisma.site.findMany({
      where: { tenantUuid },
      select: { id: true, boundary: true },
      orderBy: { createdAt: 'asc' },
    });
    const hit =
      latitude != null && longitude != null
        ? findSiteIdForPoint(latitude, longitude, sites)
        : null;
    // Sem Site não há como satisfazer o NOT NULL — sinaliza estado inválido.
    const fallback = sites[0]?.id;
    if (!hit && !fallback) {
      throw new BadRequestException(`Nenhum Site cadastrado para o tenant ${tenantUuid}.`);
    }
    resolvedId = hit ?? fallback!;
  }

  // Restrição de contorno: o recurso outdoor não pode ser criado fora do recinto.
  // Só aplica quando pedido pelo writer, há coordenada e o Site tem contorno.
  if (enforceBoundary && latitude != null && longitude != null) {
    const site = await prisma.site.findFirst({
      where: { id: resolvedId, tenantUuid },
      select: { id: true, boundary: true },
    });
    if (site?.boundary && !findSiteIdForPoint(latitude, longitude, [site])) {
      throw new BadRequestException(
        'A coordenada está fora do recinto. Posicione o recurso dentro do contorno do recinto.',
      );
    }
  }

  return resolvedId;
}

export interface ResolveTaskSiteInput {
  tenantUuid: string;
  trashBinId?: string | null;
  locationId?: string | null;
  cameraId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Resolve o `siteId` de uma TAREFA pela cadeia: trashBin → location → camera →
 * coordenada própria (Turf) → Site default. A tarefa herda o Site do recurso a
 * que está vinculada (que já tem belonging resolvido); só cai em Turf/default
 * quando é uma tarefa avulsa no mapa, sem vínculo.
 */
export async function resolveTaskSiteId(
  prisma: PrismaLike,
  input: ResolveTaskSiteInput,
): Promise<string> {
  const { tenantUuid, trashBinId, locationId, cameraId, latitude, longitude } = input;

  if (trashBinId) {
    const bin = await prisma.trashBin.findFirst({
      where: { id: trashBinId, tenantUuid },
      select: { siteId: true },
    });
    if (bin) return bin.siteId;
  }
  if (locationId) {
    const location = await prisma.location.findFirst({
      where: { id: locationId, tenantUuid },
      select: { siteId: true },
    });
    if (location) return location.siteId;
  }
  if (cameraId) {
    const camera = await prisma.camera.findFirst({
      where: { id: cameraId, tenantUuid },
      select: { siteId: true },
    });
    if (camera) return camera.siteId;
  }

  // Tarefa avulsa: trata como outdoor (coord → default).
  return resolveSiteId(prisma, { tenantUuid, locationId: null, siteId: null, latitude, longitude });
}

export interface ResolveTaskZoneInput extends ResolveTaskSiteInput {
  /** Site já resolvido da tarefa: limita as zonas candidatas ao recinto dela. */
  siteId: string;
}

/**
 * Resolve o `zoneId` de uma TAREFA pela mesma cadeia do Site: trashBin →
 * location → camera → coordenada própria. A tarefa vinculada a uma lixeira herda
 * o `zoneId` já resolvido dela (fonte única do belonging da lixeira); nos demais
 * casos cai no Turf sobre a coordenada efetiva. `null` = fora de qualquer zona,
 * que é um estado válido (não há fallback para "zona default").
 */
export async function resolveTaskZoneId(
  prisma: PrismaLike,
  input: ResolveTaskZoneInput,
): Promise<string | null> {
  const { tenantUuid, siteId, trashBinId, locationId, cameraId, latitude, longitude } = input;

  if (trashBinId) {
    const bin = await prisma.trashBin.findFirst({
      where: { id: trashBinId, tenantUuid },
      select: { zoneId: true },
    });
    if (bin) return bin.zoneId;
  }

  // Sem lixeira: usa a coordenada do recurso vinculado, ou a da própria tarefa.
  let lat = latitude ?? null;
  let lng = longitude ?? null;
  if (locationId) {
    const location = await prisma.location.findFirst({
      where: { id: locationId, tenantUuid },
      select: { latitude: true, longitude: true },
    });
    if (location) [lat, lng] = [location.latitude, location.longitude];
  } else if (cameraId) {
    const camera = await prisma.camera.findFirst({
      where: { id: cameraId, tenantUuid },
      select: { latitude: true, longitude: true },
    });
    if (camera) [lat, lng] = [camera.latitude, camera.longitude];
  }
  if (lat == null || lng == null) return null;

  const zones = await prisma.zone.findMany({
    where: { tenantUuid, siteId },
    select: { id: true, polygon: true },
    orderBy: { createdAt: 'asc' },
  });
  return findZoneIdForPoint(lat, lng, zones);
}

/**
 * Primeiro Site cujo boundary contém o ponto (lat/lng). `null` se nenhum contém
 * (o chamador decide o fallback). Sites sem boundary são ignorados.
 */
export function findSiteIdForPoint(
  latitude: number,
  longitude: number,
  sites: SiteWithBoundary[],
): string | null {
  const pt = point([longitude, latitude]); // GeoJSON é [lng, lat]
  for (const site of sites) {
    const geometry = site.boundary as BoundaryGeometry | null;
    if (!geometry) continue;
    try {
      if (booleanPointInPolygon(pt, geometry as never)) return site.id;
    } catch {
      // Boundary malformado: ignora este Site em vez de derrubar o create.
    }
  }
  return null;
}

interface ZoneWithPolygon {
  id: string;
  polygon: Prisma.JsonValue;
}

/**
 * Primeira zona cujo polígono contém o ponto (lat/lng). `null` se nenhuma contém
 * (a lixeira fica "fora de zona"). Belonging de zona é simétrico ao do Site:
 * persistido em `TrashBin.zoneId`, recalculado por esta função quando a lixeira
 * move ou a zona muda.
 *
 * Desempate de zonas sobrepostas: **determinístico pela ordem recebida** — o
 * chamador passa as zonas ordenadas por `createdAt` asc, então a zona mais antiga
 * vence. Polígonos malformados são ignorados (não derrubam a operação).
 */
export function findZoneIdForPoint(
  latitude: number,
  longitude: number,
  zones: ZoneWithPolygon[],
): string | null {
  const pt = point([longitude, latitude]); // GeoJSON é [lng, lat]
  for (const zone of zones) {
    const geometry = zone.polygon as BoundaryGeometry | null;
    if (!geometry) continue;
    try {
      if (booleanPointInPolygon(pt, geometry as never)) return zone.id;
    } catch {
      // Polígono malformado: ignora esta zona.
    }
  }
  return null;
}
