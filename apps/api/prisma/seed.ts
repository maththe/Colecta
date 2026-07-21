import { PrismaClient, TrashBinStatus, CameraStatus, TaskStatus, TaskPriority, TaskKind, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

// --- Contorno orgânico do recinto -------------------------------------------
// O contorno de demonstração era o bbox das posições, o que dava um retângulo
// perfeito no mapa — e, com as zonas dividindo esse mesmo retângulo ao meio, a
// tela virava três quadrados empilhados. Aqui geramos um contorno arredondado
// que segue o formato da nuvem de posições, parecido com o muro/cerca de um
// parque ou campus real.
//
// Não dá para cravar um polígono real (ex.: o do Ibirapuera): o seed tem
// tenants em cidades diferentes (SP e Curitiba). Então derivamos a forma dos
// próprios dados, de modo determinístico — mesmo seed, mesmo contorno.

const RING_STEPS = 48; // vértices do anel (7,5° por passo)
const SMOOTH_WINDOW = 2; // vizinhos de cada lado na suavização circular
const RING_MARGIN = 1.22; // folga sobre o raio de suporte (22%)

interface Pt {
  lat: number;
  lon: number;
}

// Longitude encolhe com a latitude; trabalhamos num espaço local em que 1
// unidade em x e em y têm a mesma distância, senão o contorno sai achatado.
function lonScale(lat: number): number {
  return Math.cos((lat * Math.PI) / 180);
}

// Contorno orgânico contendo todas as posições. Para cada direção ao redor do
// centro, o raio é o quanto a nuvem de pontos "avança" naquele sentido (função
// de suporte); suavizamos esse perfil e aplicamos uma folga, o que arredonda os
// cantos e mantém a silhueta alongada onde os pontos são alongados.
function organicBoundary(points: Pt[]) {
  const lat0 = points.reduce((a, p) => a + p.lat, 0) / points.length;
  const kx = lonScale(lat0);
  // Espaço local isométrico, com o centro dos pontos na origem.
  const xs = points.map((p) => p.lon * kx);
  const ys = points.map((p) => p.lat);
  const cx = xs.reduce((a, v) => a + v, 0) / xs.length;
  const cy = ys.reduce((a, v) => a + v, 0) / ys.length;
  const rel = points.map((_, i) => ({ x: xs[i] - cx, y: ys[i] - cy }));

  const maxDist = Math.max(...rel.map((p) => Math.hypot(p.x, p.y)));
  // Piso do raio: impede que a forma "afunde" nas direções sem posição alguma
  // (o recinto ficaria com uma mordida côncava). Também cobre o caso de uma
  // única posição, em que todos os raios de suporte seriam zero.
  const floor = Math.max(maxDist * 0.55, 0.0009);

  const angles = Array.from({ length: RING_STEPS }, (_, i) => (2 * Math.PI * i) / RING_STEPS);
  const raw = angles.map((a) => {
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const support = Math.max(...rel.map((p) => p.x * ux + p.y * uy));
    return Math.max(support, floor);
  });

  // Média móvel circular: tira os cantos vivos que a função de suporte deixa.
  const smooth = raw.map((_, i) => {
    let sum = 0;
    for (let d = -SMOOTH_WINDOW; d <= SMOOTH_WINDOW; d++) {
      sum += raw[(i + d + RING_STEPS) % RING_STEPS];
    }
    return sum / (SMOOTH_WINDOW * 2 + 1);
  });

  // Fecha o anel repetindo o primeiro vértice, convertendo de volta para [lng, lat].
  const ringAt = (grow: number) => {
    const ring = angles.map((a, i) => {
      const r = smooth[i] * RING_MARGIN * grow;
      return [(cx + r * Math.cos(a)) / kx, cy + r * Math.sin(a)] as [number, number];
    });
    return [...ring, ring[0]];
  };

  // A suavização pode encolher o raio num pico isolado, então conferimos que
  // toda posição continua dentro e crescemos o anel até caber. Converge em uma
  // ou duas voltas; o limite só evita laço infinito com dado degenerado.
  let grow = 1;
  for (let attempt = 0; attempt < 12; attempt++) {
    const ring = ringAt(grow);
    if (points.every((p) => pointInRing(p.lon, p.lat, ring))) break;
    grow *= 1.06;
  }

  return { type: 'Polygon' as const, coordinates: [ringAt(grow)] };
}

// Ray casting padrão sobre um anel fechado [lng, lat].
function pointInRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Recorta o polígono por um meio-plano vertical (Sutherland–Hodgman). Usado para
// partir o recinto em zonas Oeste/Leste que acompanham o contorno em vez de
// serem retângulos soltos por cima dele.
function clipByMeridian(
  polygon: { coordinates: [number, number][][] },
  meridian: number,
  side: 'west' | 'east',
) {
  const keep = (lon: number) => (side === 'west' ? lon <= meridian : lon >= meridian);
  const ring = polygon.coordinates[0].slice(0, -1); // sem o vértice repetido
  const out: [number, number][] = [];

  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i];
    const prev = ring[(i + ring.length - 1) % ring.length];
    const curIn = keep(cur[0]);
    const prevIn = keep(prev[0]);
    if (curIn !== prevIn) {
      // Interseção da aresta com o meridiano.
      const t = (meridian - prev[0]) / (cur[0] - prev[0]);
      out.push([meridian, prev[1] + t * (cur[1] - prev[1])]);
    }
    if (curIn) out.push(cur);
  }

  return { type: 'Polygon' as const, coordinates: [[...out, out[0]]] };
}

// ---------------------------------------------------------------------------
// Definições compartilhadas entre tenants (textos genéricos de tarefas).
// ---------------------------------------------------------------------------
const taskTitles = [
  'Esvaziar lixeira',
  'Trocar bateria do sensor',
  'Verificar sensor offline',
  'Manutenção preventiva',
  'Inspeção de rotina',
  'Limpar área ao redor',
  'Reparar compartimento',
  'Calibrar sensor de nível',
  'Coletar lixo acumulado',
  'Substituir sacola coletora',
];

const taskRoleByTitleIndex: UserRole[] = [
  UserRole.LIMPEZA,
  UserRole.MANUTENCAO,
  UserRole.MANUTENCAO,
  UserRole.MANUTENCAO,
  UserRole.MANUTENCAO,
  UserRole.LIMPEZA,
  UserRole.MANUTENCAO,
  UserRole.MANUTENCAO,
  UserRole.LIMPEZA,
  UserRole.LIMPEZA,
];

const priorities = [
  TaskPriority.low,
  TaskPriority.medium,
  TaskPriority.medium,
  TaskPriority.high,
  TaskPriority.urgent,
];

// ---------------------------------------------------------------------------
// Tipos de configuração de tenant.
// ---------------------------------------------------------------------------
interface EmployeeDef {
  email: string;
  name: string;
  role: UserRole;
  onTimeRate: number;
}

interface LocationDef {
  name: string;
  desc: string;
  lat: number;
  lon: number;
}

interface BinDef {
  name: string;
  code: string;
  locIdx: number;
  cap: number;
  status: TrashBinStatus;
  fill: number | null;
  battery: number | null;
}

interface CameraDef {
  code: string;
  name: string;
  status: CameraStatus;
  model: string;
  ipAddress: string;
  resolution: string;
  fps: number;
  lat: number;
  lon: number;
  locIdx: number | null;
  binCode: string | null;
  lastSeenHoursAgo: number;
  imageUrl: string;
  notes: string;
}

interface TenantSeed {
  tenantUuid: string;
  companyName: string;
  admin: { email: string; name: string };
  employees: EmployeeDef[];
  locations: LocationDef[];
  bins: BinDef[];
  cameras: CameraDef[];
  /** Lixeira ligada ao dispositivo MQTT real (opcional). */
  mqttBin?: { code: string; topic: string; distanceEmptyCm: number; distanceFullCm: number };
}

// ---------------------------------------------------------------------------
// Semeia todos os dados de um tenant.
// ---------------------------------------------------------------------------
async function seedTenant(cfg: TenantSeed): Promise<void> {
  const { tenantUuid: TENANT } = cfg;
  console.log(`\nSeeding tenant "${cfg.companyName}" (${TENANT})...`);

  const hashedAdmin = await bcrypt.hash('admin123', 10);
  const hashedFunc = await bcrypt.hash('funcionario123', 10);

  await prisma.user.upsert({
    where: { email: cfg.admin.email },
    update: { name: cfg.admin.name, password: hashedAdmin, role: UserRole.ADMIN, tenantUuid: TENANT },
    create: { email: cfg.admin.email, name: cfg.admin.name, password: hashedAdmin, role: UserRole.ADMIN, tenantUuid: TENANT },
  });

  const employees = await Promise.all(
    cfg.employees.map(async (e) => {
      const user = await prisma.user.upsert({
        where: { email: e.email },
        update: { name: e.name, password: hashedFunc, role: e.role, tenantUuid: TENANT },
        create: { email: e.email, name: e.name, password: hashedFunc, role: e.role, tenantUuid: TENANT },
      });
      return { ...user, onTimeRate: e.onTimeRate };
    }),
  );

  // Recinto (Site) do tenant: container espacial de topo. O seed usa um único
  // Site por tenant; tudo (construções, lixeiras, câmeras, tarefas) herda ele,
  // preservando a invariante indoor (recursos seguem location.siteId).
  const center = cfg.locations[0];
  const site = await prisma.site.create({
    data: {
      tenantUuid: TENANT,
      name: cfg.companyName,
      centerLat: center?.lat ?? null,
      centerLng: center?.lon ?? null,
      defaultZoom: 15,
    },
  });
  const withSite = <T>(rows: T[]): (T & { siteId: string })[] =>
    rows.map((row) => ({ ...row, siteId: site.id }));

  const locations = await Promise.all(
    cfg.locations.map((l) =>
      prisma.location.create({
        data: {
          tenantUuid: TENANT,
          name: l.name,
          description: l.desc,
          latitude: l.lat,
          longitude: l.lon,
          siteId: site.id,
        },
      }),
    ),
  );

  // --- Demonstração das Fases 1 e 2 -------------------------------------------
  // Contorno do recinto: anel orgânico em volta das posições (ver
  // `organicBoundary`). O front usa isso para a máscara e os limites de pan.
  // Duas zonas (Oeste/Leste) recortam esse mesmo contorno pelo meridiano
  // central, de modo que toda lixeira cai em uma zona e as zonas acompanham a
  // borda do recinto em vez de estourarem para fora dela.
  const boundary = organicBoundary(cfg.locations);
  const ringLons = boundary.coordinates[0].map(([lon]) => lon);
  const midLon = (Math.min(...ringLons) + Math.max(...ringLons)) / 2;

  await prisma.site.update({
    where: { id: site.id },
    data: { boundary },
  });

  const zoneOeste = await prisma.zone.create({
    data: {
      tenantUuid: TENANT,
      siteId: site.id,
      name: 'Zona Oeste',
      category: 'Operação',
      color: '#2563eb',
      polygon: clipByMeridian(boundary, midLon, 'west'),
    },
  });
  const zoneLeste = await prisma.zone.create({
    data: {
      tenantUuid: TENANT,
      siteId: site.id,
      name: 'Zona Leste',
      category: 'Operação',
      color: '#16a34a',
      polygon: clipByMeridian(boundary, midLon, 'east'),
    },
  });
  // Lixeira indoor herda a coordenada da construção: a zona é decidida pela
  // longitude da posição (espelha o que o recompute do back faria via Turf).
  const zoneIdForLoc = (locIdx: number): string =>
    cfg.locations[locIdx].lon < midLon ? zoneOeste.id : zoneLeste.id;

  const now = new Date();

  const bins = await Promise.all(
    cfg.bins.map((b) => {
      const isMqtt = cfg.mqttBin?.code === b.code;
      return prisma.trashBin.create({
        data: {
          tenantUuid: TENANT,
          name: b.name,
          code: b.code,
          locationId: locations[b.locIdx].id,
          siteId: site.id,
          zoneId: zoneIdForLoc(b.locIdx),
          capacityLiters: b.cap,
          status: b.status,
          fillLevel: b.fill,
          batteryLevel: b.battery,
          mqttTopic: isMqtt ? cfg.mqttBin!.topic : null,
          distanceEmptyCm: isMqtt ? cfg.mqttBin!.distanceEmptyCm : null,
          distanceFullCm: isMqtt ? cfg.mqttBin!.distanceFullCm : null,
          lastSeenAt:
            b.status === TrashBinStatus.offline
              ? new Date(now.getTime() - 48 * HOUR_MS)
              : now,
        },
      });
    }),
  );

  // Câmeras de segurança vinculadas a posições e lixeiras reais.
  const binByCode = new Map(bins.map((bin) => [bin.code, bin]));

  await prisma.camera.createMany({
    data: cfg.cameras.map((c) => {
      const bin = c.binCode ? binByCode.get(c.binCode) : null;
      return {
        tenantUuid: TENANT,
        code: c.code,
        name: c.name,
        status: c.status,
        model: c.model,
        ipAddress: c.ipAddress,
        resolution: c.resolution,
        fps: c.fps,
        latitude: c.lat,
        longitude: c.lon,
        imageUrl: c.imageUrl,
        notes: c.notes,
        lastSeenAt: new Date(now.getTime() - c.lastSeenHoursAgo * HOUR_MS),
        locationId: c.locIdx !== null ? locations[c.locIdx].id : bin?.locationId ?? null,
        trashBinId: bin?.id ?? null,
        siteId: site.id,
      };
    }),
  });
  console.log(`  Created ${cfg.cameras.length} cameras`);

  // Sensor readings: 4 semanas de leituras para lixeiras com dados de nível.
  const sensorRows: {
    tenantUuid: string;
    trashBinId: string;
    fillLevel: number;
    batteryLevel: number | null;
    temperature: number | null;
    payload: object;
    receivedAt: Date;
    createdAt: Date;
  }[] = [];

  for (let binIdx = 0; binIdx < bins.length; binIdx++) {
    const bin = bins[binIdx];
    const def = cfg.bins[binIdx];
    if (def.fill === null) continue;

    for (let dayOffset = 28; dayOffset >= 0; dayOffset--) {
      for (let slot = 0; slot < 2; slot++) {
        const hour = slot === 0 ? 8 : 18;
        const receivedAt = new Date(now.getTime() - dayOffset * DAY_MS + hour * HOUR_MS);
        const cycleDay = (28 - dayOffset) % 8;
        const baseFill = 15 + (binIdx * 11) % 25;
        const fill = Math.min(97, baseFill + cycleDay * 9 + slot * 4);
        const battery = Math.max(8, 90 - Math.floor((28 - dayOffset) * 0.9));

        sensorRows.push({
          tenantUuid: TENANT,
          trashBinId: bin.id,
          fillLevel: Math.round(fill),
          batteryLevel: Math.round(battery),
          temperature: 22 + slot * 4,
          payload: { source: 'seed' },
          receivedAt,
          createdAt: receivedAt,
        });
      }
    }
  }

  await prisma.sensorReading.createMany({ data: sensorRows });
  console.log(`  Created ${sensorRows.length} sensor readings`);

  // Tarefas históricas: 12 semanas, ~15 tarefas/semana = ~180 total.
  const historyRows: {
    tenantUuid: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    kind: TaskKind;
    trashBinId: string;
    locationId: string;
    startedById: string;
    assigneeRole: UserRole;
    assigneeName: string;
    dueDate: Date;
    startedAt: Date;
    completedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];

  let counter = 0;
  for (let week = 11; week >= 0; week--) {
    const weekBase = new Date(now.getTime() - (week + 1) * 7 * DAY_MS);
    const tasksThisWeek = 12 + (counter % 7);

    for (let i = 0; i < tasksThisWeek; i++) {
      counter++;
      const dayInWeek = (counter * 3) % 5;
      const hourInDay = ((counter * 7) % 10) + 7;
      const createdAt = new Date(weekBase.getTime() + dayInWeek * DAY_MS + hourInDay * HOUR_MS);

      const startedAt = new Date(createdAt.getTime() + ((counter % 3) + 1) * 30 * 60_000);
      const resolutionMinutes = 30 + (counter % 24) * 30;
      const completedAt = new Date(startedAt.getTime() + resolutionMinutes * 60_000);

      const taskTitleIndex = counter % taskTitles.length;
      const assigneeRole = taskRoleByTitleIndex[taskTitleIndex] ?? UserRole.LIMPEZA;
      const roleEmployees = employees.filter((employee) => employee.role === assigneeRole);
      const emp = roleEmployees[counter % roleEmployees.length] ?? employees[counter % employees.length];
      const isOnTime = (counter % 100) < Math.round(emp.onTimeRate * 100);
      const dueDateOffset = isOnTime
        ? (1 + (counter % 3)) * HOUR_MS
        : -(1 + (counter % 2)) * HOUR_MS;
      const dueDate = new Date(completedAt.getTime() + dueDateOffset);

      const binIdx = counter % bins.length;
      const bin = bins[binIdx];
      const locIdx = cfg.bins[binIdx].locIdx;
      const title = `${taskTitles[taskTitleIndex]} – ${cfg.bins[binIdx].code}`;

      historyRows.push({
        tenantUuid: TENANT,
        title,
        status: TaskStatus.done,
        priority: priorities[counter % priorities.length],
        kind: TaskKind.manual,
        trashBinId: bin.id,
        locationId: locations[locIdx].id,
        startedById: emp.id,
        assigneeRole,
        assigneeName: emp.name,
        dueDate,
        startedAt,
        completedAt,
        createdAt,
        updatedAt: completedAt,
      });
    }
  }

  await prisma.task.createMany({ data: withSite(historyRows) });
  console.log(`  Created ${historyRows.length} historical tasks`);

  // Tarefas abertas atuais.
  await prisma.task.createMany({
    data: withSite([
      {
        tenantUuid: TENANT,
        title: `Esvaziar ${cfg.bins[2].code} (lixeira cheia)`,
        description: `${cfg.bins[2].name} está com 97% — precisa de coleta urgente.`,
        status: TaskStatus.pending,
        priority: TaskPriority.urgent,
        trashBinId: bins[2].id,
        locationId: locations[cfg.bins[2].locIdx].id,
        assigneeRole: UserRole.LIMPEZA,
        assigneeName: employees[0].name,
        dueDate: new Date(now.getTime() + 2 * HOUR_MS),
      },
      {
        tenantUuid: TENANT,
        title: `Trocar bateria sensor ${cfg.bins[4].code}`,
        description: 'Bateria baixa, risco de perda de sinal.',
        status: TaskStatus.in_progress,
        priority: TaskPriority.high,
        trashBinId: bins[4].id,
        locationId: locations[cfg.bins[4].locIdx].id,
        startedById: employees[1].id,
        startedAt: new Date(now.getTime() - 2 * HOUR_MS),
        assigneeRole: UserRole.MANUTENCAO,
        assigneeName: employees[1].name,
        dueDate: new Date(now.getTime() + 4 * HOUR_MS),
      },
      {
        tenantUuid: TENANT,
        title: `Verificar lixeira offline ${cfg.bins[7].code}`,
        description: 'Sem leituras de sensor há 48h.',
        status: TaskStatus.pending,
        priority: TaskPriority.urgent,
        trashBinId: bins[7].id,
        locationId: locations[cfg.bins[7].locIdx].id,
        assigneeRole: UserRole.MANUTENCAO,
        assigneeName: employees[1].name,
        dueDate: new Date(now.getTime() + HOUR_MS),
      },
      {
        tenantUuid: TENANT,
        title: `Manutenção compartimento ${cfg.bins[5].code}`,
        description: 'Reparar dobradiça danificada.',
        status: TaskStatus.in_progress,
        priority: TaskPriority.medium,
        trashBinId: bins[5].id,
        locationId: locations[cfg.bins[5].locIdx].id,
        startedById: employees[4].id,
        startedAt: new Date(now.getTime() - 5 * HOUR_MS),
        assigneeRole: UserRole.MANUTENCAO,
        assigneeName: employees[4].name,
        dueDate: new Date(now.getTime() + 3 * DAY_MS),
      },
      {
        tenantUuid: TENANT,
        title: `Coletar lixo acumulado ${cfg.bins[10].code}`,
        description: `${cfg.bins[10].name} com 82% — próximo do limite.`,
        status: TaskStatus.pending,
        priority: TaskPriority.high,
        trashBinId: bins[10].id,
        locationId: locations[cfg.bins[10].locIdx].id,
        assigneeRole: UserRole.LIMPEZA,
        assigneeName: employees[3].name,
        dueDate: daysAgo(1),
      },
      {
        tenantUuid: TENANT,
        title: 'Inspeção semanal da frota',
        description: 'Revisão quinzenal de todas as lixeiras.',
        status: TaskStatus.pending,
        priority: TaskPriority.low,
        assigneeRole: UserRole.MANUTENCAO,
        dueDate: new Date(now.getTime() + 2 * DAY_MS),
      },
    ]),
  });

  // Tarefas posicionadas livremente no mapa (lat/lng próprias, sem vínculo a
  // lixeira/posição). Servem para validar os marcadores de tarefa e a regra de
  // visibilidade por equipe. Espalhadas a partir do centro do parque.
  const mapAnchor = cfg.locations[0];
  const cleaner = employees.find((e) => e.role === UserRole.LIMPEZA);
  const maintainer = employees.find((e) => e.role === UserRole.MANUTENCAO);
  const guard = employees.find((e) => e.role === UserRole.SEGURANCA);
  await prisma.task.createMany({
    data: withSite([
      {
        tenantUuid: TENANT,
        title: 'Recolher entulho relatado por visitante',
        description: 'Ponto marcado no mapa pelo admin; sem lixeira por perto.',
        status: TaskStatus.pending,
        priority: TaskPriority.high,
        latitude: mapAnchor.lat + 0.0009,
        longitude: mapAnchor.lon + 0.0011,
        assigneeRole: UserRole.LIMPEZA,
        assigneeName: cleaner?.name ?? null,
        dueDate: new Date(now.getTime() + 6 * HOUR_MS),
      },
      {
        tenantUuid: TENANT,
        title: 'Avaliar poste de iluminação danificado',
        description: 'Local marcado no mapa para inspeção da manutenção.',
        status: TaskStatus.in_progress,
        priority: TaskPriority.medium,
        latitude: mapAnchor.lat - 0.0012,
        longitude: mapAnchor.lon + 0.0007,
        startedById: maintainer?.id,
        startedAt: new Date(now.getTime() - 1 * HOUR_MS),
        assigneeRole: UserRole.MANUTENCAO,
        assigneeName: maintainer?.name ?? null,
        dueDate: new Date(now.getTime() + 1 * DAY_MS),
      },
      {
        tenantUuid: TENANT,
        title: 'Rondar área sem cobertura de câmera',
        description: 'Ponto cego marcado no mapa para a equipe de segurança.',
        status: TaskStatus.pending,
        priority: TaskPriority.urgent,
        latitude: mapAnchor.lat + 0.0006,
        longitude: mapAnchor.lon - 0.0013,
        assigneeRole: UserRole.SEGURANCA,
        assigneeName: guard?.name ?? null,
        dueDate: new Date(now.getTime() + 3 * HOUR_MS),
      },
    ]),
  });

  console.log(
    `  Seed de "${cfg.companyName}" concluído: ${bins.length} lixeiras, ${cfg.cameras.length} câmeras, ${employees.length} usuários operacionais, ${historyRows.length} tarefas históricas.`,
  );
}

// ---------------------------------------------------------------------------
// Tenant 1: Colecta (parque urbano).
// ---------------------------------------------------------------------------
const colecta: TenantSeed = {
  tenantUuid: '00000000-0000-0000-0000-000000000001',
  companyName: 'Colecta',
  admin: { email: 'admin@colecta.com', name: 'Admin Colecta' },
  mqttBin: { code: 'PRQ-001', topic: 'binovate/medidas', distanceEmptyCm: 80, distanceFullCm: 10 },
  employees: [
    { email: 'carlos@colecta.com', name: 'Carlos Silva', role: UserRole.LIMPEZA, onTimeRate: 0.88 },
    { email: 'ana@colecta.com', name: 'Ana Souza', role: UserRole.MANUTENCAO, onTimeRate: 0.93 },
    { email: 'joao@colecta.com', name: 'João Oliveira', role: UserRole.SEGURANCA, onTimeRate: 0.71 },
    { email: 'maria@colecta.com', name: 'Maria Santos', role: UserRole.LIMPEZA, onTimeRate: 0.85 },
    { email: 'pedro@colecta.com', name: 'Pedro Costa', role: UserRole.MANUTENCAO, onTimeRate: 0.78 },
    { email: 'beatriz@colecta.com', name: 'Beatriz Lima', role: UserRole.FINANCEIRO, onTimeRate: 0.96 },
  ],
  locations: [
    { name: 'Entrada Norte', desc: 'Próxima ao portão de entrada norte', lat: -23.5874, lon: -46.6576 },
    { name: 'Playground', desc: 'Ao lado do playground infantil', lat: -23.5881, lon: -46.6563 },
    { name: 'Pista de Corrida', desc: 'Início da pista de corrida', lat: -23.5892, lon: -46.6588 },
    { name: 'Quiosque Central', desc: 'Atrás do quiosque central', lat: -23.5868, lon: -46.6594 },
    { name: 'Lago', desc: 'Margem leste do lago', lat: -23.5901, lon: -46.6552 },
    { name: 'Bosque Sul', desc: 'Área arborizada ao sul do parque', lat: -23.5915, lon: -46.6570 },
    { name: 'Arena de Esportes', desc: 'Quadras poliesportivas', lat: -23.5858, lon: -46.6600 },
  ],
  bins: [
    { name: 'Lixeira Entrada Norte A', code: 'PRQ-001', locIdx: 0, cap: 120, status: TrashBinStatus.active, fill: 35, battery: 87 },
    { name: 'Lixeira Entrada Norte B', code: 'PRQ-002', locIdx: 0, cap: 80, status: TrashBinStatus.active, fill: 62, battery: 73 },
    { name: 'Lixeira Playground',       code: 'PRQ-003', locIdx: 1, cap: 80,  status: TrashBinStatus.full,  fill: 97, battery: 55 },
    { name: 'Lixeira Playground Selet.', code: 'PRQ-004', locIdx: 1, cap: 60, status: TrashBinStatus.active, fill: 44, battery: 81 },
    { name: 'Lixeira Pista de Corrida', code: 'PRQ-005', locIdx: 2, cap: 100, status: TrashBinStatus.active, fill: 28, battery: 12 },
    { name: 'Lixeira Quiosque Central', code: 'PRQ-006', locIdx: 3, cap: 150, status: TrashBinStatus.maintenance, fill: 20, battery: 70 },
    { name: 'Lixeira Quiosque Selet.',  code: 'PRQ-007', locIdx: 3, cap: 100, status: TrashBinStatus.active, fill: 55, battery: 66 },
    { name: 'Lixeira Lago A',           code: 'PRQ-008', locIdx: 4, cap: 100, status: TrashBinStatus.offline, fill: null, battery: null },
    { name: 'Lixeira Lago B',           code: 'PRQ-009', locIdx: 4, cap: 80,  status: TrashBinStatus.active, fill: 71, battery: 44 },
    { name: 'Lixeira Bosque Sul',       code: 'PRQ-010', locIdx: 5, cap: 120, status: TrashBinStatus.active, fill: 30, battery: 92 },
    { name: 'Lixeira Arena A',          code: 'PRQ-011', locIdx: 6, cap: 150, status: TrashBinStatus.active, fill: 82, battery: 60 },
    { name: 'Lixeira Arena B',          code: 'PRQ-012', locIdx: 6, cap: 100, status: TrashBinStatus.inactive, fill: null, battery: 35 },
  ],
  cameras: [
    {
      code: 'CAM-001',
      name: 'Entrada Norte - Entrada',
      status: CameraStatus.online,
      model: 'Hikvision DS-2CD2143G2',
      ipAddress: '10.10.12.21',
      resolution: '1920x1080',
      fps: 30,
      lat: -23.587,
      lon: -46.658,
      locIdx: 0,
      binCode: null,
      lastSeenHoursAgo: 0,
      imageUrl: '/security/cameras/passagens-aereas-sao-paulo-capa2019-04-820x430.jpg',
      notes: 'Cobertura da entrada principal e catracas.',
    },
    {
      code: 'CAM-002',
      name: 'Entrada Norte - Lixeira PRQ-001',
      status: CameraStatus.online,
      model: 'Intelbras VIP 1230',
      ipAddress: '10.10.12.22',
      resolution: '1280x720',
      fps: 24,
      lat: -23.5878,
      lon: -46.6572,
      locIdx: null,
      binCode: 'PRQ-001',
      lastSeenHoursAgo: 0,
      imageUrl: '/security/cameras/ibirapuera-entrada-norte-lixeira.jpg',
      notes: 'Foco no ponto de descarte junto à entrada.',
    },
    {
      code: 'CAM-003',
      name: 'Playground - Visão geral',
      status: CameraStatus.maintenance,
      model: 'Dahua IPC-HFW2431S',
      ipAddress: '10.10.18.14',
      resolution: '1920x1080',
      fps: 25,
      lat: -23.5884,
      lon: -46.6567,
      locIdx: 1,
      binCode: null,
      lastSeenHoursAgo: 4,
      imageUrl: '/security/cameras/playground-central.jpg',
      notes: 'Aguardando ajuste de foco.',
    },
    {
      code: 'CAM-004',
      name: 'Lago - Lixeira PRQ-008',
      status: CameraStatus.online,
      model: 'Axis M2035-LE',
      ipAddress: '10.10.22.9',
      resolution: '1920x1080',
      fps: 30,
      lat: -23.5905,
      lon: -46.6548,
      locIdx: null,
      binCode: 'PRQ-008',
      lastSeenHoursAgo: 0,
      imageUrl: '/security/cameras/ibirapuera-lago.avif',
      notes: 'Cobre a margem do lago e o ponto de coleta.',
    },
    {
      code: 'CAM-005',
      name: 'Pista de Corrida - Ponto 3',
      status: CameraStatus.offline,
      model: 'Intelbras VIP 3230',
      ipAddress: '10.10.24.33',
      resolution: '1280x720',
      fps: 20,
      lat: -23.5896,
      lon: -46.6592,
      locIdx: 2,
      binCode: null,
      lastSeenHoursAgo: 36,
      imageUrl: '/security/cameras/trilha-oeste-ponto-3.jpg',
      notes: 'Sem comunicação desde a noite anterior.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Tenant 2: Disney (parque temático). Coordenadas aprox. do Magic Kingdom (FL).
// ---------------------------------------------------------------------------
const disney: TenantSeed = {
  tenantUuid: '00000000-0000-0000-0000-000000000002',
  companyName: 'Disney',
  admin: { email: 'admin@disney.com', name: 'Admin Disney' },
  employees: [
    { email: 'mickey@disney.com', name: 'Mickey Mouse', role: UserRole.LIMPEZA, onTimeRate: 0.95 },
    { email: 'minnie@disney.com', name: 'Minnie Mouse', role: UserRole.MANUTENCAO, onTimeRate: 0.91 },
    { email: 'donald@disney.com', name: 'Donald Duck', role: UserRole.SEGURANCA, onTimeRate: 0.74 },
    { email: 'goofy@disney.com', name: 'Goofy Goof', role: UserRole.LIMPEZA, onTimeRate: 0.82 },
    { email: 'pluto@disney.com', name: 'Pluto Pup', role: UserRole.MANUTENCAO, onTimeRate: 0.79 },
    { email: 'daisy@disney.com', name: 'Daisy Duck', role: UserRole.FINANCEIRO, onTimeRate: 0.97 },
  ],
  locations: [
    { name: 'Main Street, U.S.A.', desc: 'Avenida principal logo após a entrada', lat: 28.4177, lon: -81.5812 },
    { name: 'Cinderella Castle', desc: 'Praça em frente ao castelo da Cinderela', lat: 28.4189, lon: -81.5810 },
    { name: 'Fantasyland', desc: 'Área das atrações infantis', lat: 28.4200, lon: -81.5799 },
    { name: 'Tomorrowland', desc: 'Próximo à Space Mountain', lat: 28.4187, lon: -81.5790 },
    { name: 'Adventureland', desc: 'Entrada de Pirates of the Caribbean', lat: 28.4175, lon: -81.5832 },
    { name: 'Frontierland', desc: 'Junto à Big Thunder Mountain', lat: 28.4193, lon: -81.5840 },
    { name: "It's a Small World", desc: 'Saída da atração clássica', lat: 28.4205, lon: -81.5805 },
  ],
  cameras: [
    {
      code: 'DSN-CAM-001',
      name: 'Main Street - Entrada',
      status: CameraStatus.online,
      model: 'Hikvision DS-2CD2143G2',
      ipAddress: '10.20.12.21',
      resolution: '1920x1080',
      fps: 30,
      lat: 28.4176,
      lon: -81.5813,
      locIdx: 0,
      binCode: null,
      lastSeenHoursAgo: 0,
      imageUrl: '/security/cameras/portaria-norte-entrada.jpg',
      notes: 'Cobertura das catracas e da Main Street.',
    },
    {
      code: 'DSN-CAM-002',
      name: 'Castelo - Lixeira DSN-002',
      status: CameraStatus.online,
      model: 'Intelbras VIP 1230',
      ipAddress: '10.20.12.22',
      resolution: '1280x720',
      fps: 24,
      lat: 28.4188,
      lon: -81.5811,
      locIdx: null,
      binCode: 'DSN-002',
      lastSeenHoursAgo: 0,
      imageUrl: '/security/cameras/portaria-norte-lixeira.jpg',
      notes: 'Foco no ponto de descarte da praça do castelo.',
    },
    {
      code: 'DSN-CAM-003',
      name: 'Fantasyland - Visão geral',
      status: CameraStatus.maintenance,
      model: 'Dahua IPC-HFW2431S',
      ipAddress: '10.20.18.14',
      resolution: '1920x1080',
      fps: 25,
      lat: 28.4201,
      lon: -81.5798,
      locIdx: 2,
      binCode: null,
      lastSeenHoursAgo: 4,
      imageUrl: '/security/cameras/playground-central.jpg',
      notes: 'Aguardando ajuste de foco.',
    },
    {
      code: 'DSN-CAM-004',
      name: 'Adventureland - Lixeira DSN-008',
      status: CameraStatus.online,
      model: 'Axis M2035-LE',
      ipAddress: '10.20.22.9',
      resolution: '1920x1080',
      fps: 30,
      lat: 28.4174,
      lon: -81.5831,
      locIdx: null,
      binCode: 'DSN-008',
      lastSeenHoursAgo: 0,
      imageUrl: '/security/cameras/lago-ipes-deque.jpg',
      notes: 'Cobre a fila de Pirates of the Caribbean.',
    },
    {
      code: 'DSN-CAM-005',
      name: 'Tomorrowland - Ponto 3',
      status: CameraStatus.offline,
      model: 'Intelbras VIP 3230',
      ipAddress: '10.20.24.33',
      resolution: '1280x720',
      fps: 20,
      lat: 28.4186,
      lon: -81.5791,
      locIdx: 3,
      binCode: null,
      lastSeenHoursAgo: 36,
      imageUrl: '/security/cameras/trilha-oeste-ponto-3.jpg',
      notes: 'Sem comunicação desde a noite anterior.',
    },
  ],
  bins: [
    { name: 'Lixeira Main Street A',     code: 'DSN-001', locIdx: 0, cap: 120, status: TrashBinStatus.active, fill: 40, battery: 90 },
    { name: 'Lixeira Castelo',           code: 'DSN-002', locIdx: 1, cap: 100, status: TrashBinStatus.active, fill: 58, battery: 77 },
    { name: 'Lixeira Fantasyland',       code: 'DSN-003', locIdx: 2, cap: 80,  status: TrashBinStatus.full,  fill: 97, battery: 50 },
    { name: 'Lixeira Fantasyland Selet.', code: 'DSN-004', locIdx: 2, cap: 60, status: TrashBinStatus.active, fill: 49, battery: 84 },
    { name: 'Lixeira Tomorrowland',      code: 'DSN-005', locIdx: 3, cap: 100, status: TrashBinStatus.active, fill: 33, battery: 14 },
    { name: 'Lixeira Tomorrowland B',    code: 'DSN-006', locIdx: 3, cap: 150, status: TrashBinStatus.maintenance, fill: 22, battery: 68 },
    { name: 'Lixeira Frontierland',      code: 'DSN-007', locIdx: 5, cap: 100, status: TrashBinStatus.active, fill: 60, battery: 63 },
    { name: 'Lixeira Adventureland A',   code: 'DSN-008', locIdx: 4, cap: 100, status: TrashBinStatus.offline, fill: null, battery: null },
    { name: 'Lixeira Adventureland B',   code: 'DSN-009', locIdx: 4, cap: 80,  status: TrashBinStatus.active, fill: 68, battery: 47 },
    { name: 'Lixeira Small World',       code: 'DSN-010', locIdx: 6, cap: 120, status: TrashBinStatus.active, fill: 27, battery: 88 },
    { name: 'Lixeira Frontierland B',    code: 'DSN-011', locIdx: 5, cap: 150, status: TrashBinStatus.active, fill: 82, battery: 58 },
    { name: 'Lixeira Small World Selet.', code: 'DSN-012', locIdx: 6, cap: 100, status: TrashBinStatus.inactive, fill: null, battery: 30 },
  ],
};

// ---------------------------------------------------------------------------
// Tenant 3: Central Park Zoo. Coordenadas aprox. do zoológico (Manhattan, NY).
// ---------------------------------------------------------------------------
const centralParkZoo: TenantSeed = {
  tenantUuid: '00000000-0000-0000-0000-000000000003',
  companyName: 'Central Park Zoo',
  admin: { email: 'admin@centralpark.com', name: 'Admin Central Park Zoo' },
  employees: [
    { email: 'james@centralpark.com', name: 'James Carter', role: UserRole.LIMPEZA, onTimeRate: 0.9 },
    { email: 'olivia@centralpark.com', name: 'Olivia Bennett', role: UserRole.MANUTENCAO, onTimeRate: 0.92 },
    { email: 'william@centralpark.com', name: 'William Brooks', role: UserRole.SEGURANCA, onTimeRate: 0.76 },
    { email: 'emma@centralpark.com', name: 'Emma Reed', role: UserRole.LIMPEZA, onTimeRate: 0.84 },
    { email: 'noah@centralpark.com', name: 'Noah Foster', role: UserRole.MANUTENCAO, onTimeRate: 0.8 },
    { email: 'sophia@centralpark.com', name: 'Sophia Hayes', role: UserRole.FINANCEIRO, onTimeRate: 0.95 },
  ],
  locations: [
    { name: 'Main Entrance', desc: 'Entrada principal na 5th Ave com a 64th St', lat: 40.7681, lon: -73.9715 },
    { name: 'Sea Lion Pool', desc: 'Piscina central dos leões-marinhos', lat: 40.7678, lon: -73.9718 },
    { name: 'Tropic Zone', desc: 'Pavilhão de aves e fauna tropical', lat: 40.7674, lon: -73.9716 },
    { name: 'Polar Circle', desc: 'Habitat de pinguins e aves marinhas', lat: 40.7682, lon: -73.9722 },
    { name: 'Temperate Territory', desc: 'Área dos pandas-vermelhos', lat: 40.7676, lon: -73.9712 },
    { name: "Tisch Children's Zoo", desc: 'Zoológico infantil interativo (65th St)', lat: 40.7690, lon: -73.9710 },
    { name: 'Snow Leopard Exhibit', desc: 'Habitat dos leopardos-das-neves', lat: 40.7679, lon: -73.9724 },
    { name: 'Bethesda Terrace', desc: 'Terraço e fonte junto ao The Mall', lat: 40.7740, lon: -73.9709 },
    { name: 'Bow Bridge', desc: 'Ponte sobre o The Lake', lat: 40.7757, lon: -73.9722 },
  ],
  cameras: [
    {
      code: 'CPZ-CAM-001',
      name: 'Main Entrance - Catracas',
      status: CameraStatus.online,
      model: 'Hikvision DS-2CD2143G2',
      ipAddress: '10.30.12.21',
      resolution: '1920x1080',
      fps: 30,
      lat: 40.7681,
      lon: -73.9716,
      locIdx: 0,
      binCode: null,
      lastSeenHoursAgo: 0,
      imageUrl: '/security/cameras/portaria-norte-entrada.jpg',
      notes: 'Cobertura da entrada principal e bilheteria.',
    },
    {
      code: 'CPZ-CAM-002',
      name: 'Sea Lion Pool - Lixeira CPZ-002',
      status: CameraStatus.online,
      model: 'Intelbras VIP 1230',
      ipAddress: '10.30.12.22',
      resolution: '1280x720',
      fps: 24,
      lat: 40.7677,
      lon: -73.9719,
      locIdx: null,
      binCode: 'CPZ-002',
      lastSeenHoursAgo: 0,
      imageUrl: '/security/cameras/portaria-norte-lixeira.jpg',
      notes: 'Foco no ponto de descarte da piscina dos leões-marinhos.',
    },
    {
      code: 'CPZ-CAM-003',
      name: 'Tropic Zone - Visão geral',
      status: CameraStatus.maintenance,
      model: 'Dahua IPC-HFW2431S',
      ipAddress: '10.30.18.14',
      resolution: '1920x1080',
      fps: 25,
      lat: 40.7673,
      lon: -73.9717,
      locIdx: 2,
      binCode: null,
      lastSeenHoursAgo: 4,
      imageUrl: '/security/cameras/playground-central.jpg',
      notes: 'Aguardando ajuste de foco.',
    },
    {
      code: 'CPZ-CAM-004',
      name: 'Polar Circle - Lixeira CPZ-008',
      status: CameraStatus.online,
      model: 'Axis M2035-LE',
      ipAddress: '10.30.22.9',
      resolution: '1920x1080',
      fps: 30,
      lat: 40.7683,
      lon: -73.9723,
      locIdx: null,
      binCode: 'CPZ-008',
      lastSeenHoursAgo: 0,
      imageUrl: '/security/cameras/lago-ipes-deque.jpg',
      notes: 'Cobre a área de alimentação dos pinguins.',
    },
    {
      code: 'CPZ-CAM-005',
      name: 'Temperate Territory - Ponto 3',
      status: CameraStatus.offline,
      model: 'Intelbras VIP 3230',
      ipAddress: '10.30.24.33',
      resolution: '1280x720',
      fps: 20,
      lat: 40.7675,
      lon: -73.9711,
      locIdx: 4,
      binCode: null,
      lastSeenHoursAgo: 36,
      imageUrl: '/security/cameras/trilha-oeste-ponto-3.jpg',
      notes: 'Sem comunicação desde a noite anterior.',
    },
    {
      code: 'CPZ-CAM-006',
      name: 'Bethesda Terrace - Lixeira CPZ-014',
      status: CameraStatus.online,
      model: 'Hikvision DS-2CD2143G2',
      ipAddress: '10.30.26.40',
      resolution: '1920x1080',
      fps: 30,
      lat: 40.7741,
      lon: -73.9708,
      locIdx: null,
      binCode: 'CPZ-014',
      lastSeenHoursAgo: 0,
      imageUrl: '/security/cameras/portaria-norte-lixeira.jpg',
      notes: 'Cobre o terraço e a fonte de Bethesda.',
    },
  ],
  bins: [
    { name: 'Lixeira Main Entrance A',    code: 'CPZ-001', locIdx: 0, cap: 120, status: TrashBinStatus.active, fill: 42, battery: 89 },
    { name: 'Lixeira Sea Lion Pool',      code: 'CPZ-002', locIdx: 1, cap: 100, status: TrashBinStatus.active, fill: 57, battery: 75 },
    { name: 'Lixeira Tropic Zone',        code: 'CPZ-003', locIdx: 2, cap: 80,  status: TrashBinStatus.full,  fill: 97, battery: 52 },
    { name: 'Lixeira Tropic Zone Selet.', code: 'CPZ-004', locIdx: 2, cap: 60,  status: TrashBinStatus.active, fill: 46, battery: 83 },
    { name: 'Lixeira Temperate Terr.',    code: 'CPZ-005', locIdx: 4, cap: 100, status: TrashBinStatus.active, fill: 31, battery: 13 },
    { name: 'Lixeira Temperate Terr. B',  code: 'CPZ-006', locIdx: 4, cap: 150, status: TrashBinStatus.maintenance, fill: 24, battery: 69 },
    { name: "Lixeira Children's Zoo",     code: 'CPZ-007', locIdx: 5, cap: 100, status: TrashBinStatus.active, fill: 61, battery: 64 },
    { name: 'Lixeira Polar Circle A',     code: 'CPZ-008', locIdx: 3, cap: 100, status: TrashBinStatus.offline, fill: null, battery: null },
    { name: 'Lixeira Polar Circle B',     code: 'CPZ-009', locIdx: 3, cap: 80,  status: TrashBinStatus.active, fill: 66, battery: 49 },
    { name: 'Lixeira Snow Leopard',       code: 'CPZ-010', locIdx: 6, cap: 120, status: TrashBinStatus.active, fill: 29, battery: 86 },
    { name: "Lixeira Children's Zoo B",   code: 'CPZ-011', locIdx: 5, cap: 150, status: TrashBinStatus.active, fill: 82, battery: 57 },
    { name: 'Lixeira Snow Leopard Selet.', code: 'CPZ-012', locIdx: 6, cap: 100, status: TrashBinStatus.inactive, fill: null, battery: 31 },
    { name: 'Lixeira Bethesda Terrace A',  code: 'CPZ-013', locIdx: 7, cap: 120, status: TrashBinStatus.active, fill: 53, battery: 80 },
    { name: 'Lixeira Bethesda Terrace B',  code: 'CPZ-014', locIdx: 7, cap: 100, status: TrashBinStatus.full,  fill: 95, battery: 41 },
    { name: 'Lixeira Bow Bridge',          code: 'CPZ-015', locIdx: 8, cap: 80,  status: TrashBinStatus.active, fill: 38, battery: 72 },
  ],
};

// ---------------------------------------------------------------------------
// Tenant 4: PUCPR (campus universitário). Coordenadas aprox. do campus
// Curitiba (Prado Velho, PR).
// ---------------------------------------------------------------------------
const pucpr: TenantSeed = {
  tenantUuid: '00000000-0000-0000-0000-000000000004',
  companyName: 'PUCPR Curitiba',
  admin: { email: 'admin@pucpr.br', name: 'Admin PUCPR' },
  employees: [
    { email: 'lucas@pucpr.br', name: 'Lucas Almeida', role: UserRole.LIMPEZA, onTimeRate: 0.89 },
    { email: 'fernanda@pucpr.br', name: 'Fernanda Ribeiro', role: UserRole.MANUTENCAO, onTimeRate: 0.92 },
    { email: 'rafael@pucpr.br', name: 'Rafael Moraes', role: UserRole.SEGURANCA, onTimeRate: 0.73 },
    { email: 'juliana@pucpr.br', name: 'Juliana Cardoso', role: UserRole.LIMPEZA, onTimeRate: 0.86 },
    { email: 'bruno@pucpr.br', name: 'Bruno Schneider', role: UserRole.MANUTENCAO, onTimeRate: 0.8 },
    { email: 'camila@pucpr.br', name: 'Camila Andrade', role: UserRole.FINANCEIRO, onTimeRate: 0.95 },
  ],
  locations: [
    { name: 'Portaria Principal', desc: 'Entrada principal pela Rua Imaculada Conceição', lat: -25.4419, lon: -49.2478 },
    { name: 'Bloco Amarelo', desc: 'Próximo ao bloco amarelo de salas de aula', lat: -25.4426, lon: -49.2470 },
    { name: 'Biblioteca Central', desc: 'Em frente à Biblioteca Central', lat: -25.4431, lon: -49.2483 },
    { name: 'Praça da Reitoria', desc: 'Praça central junto à reitoria', lat: -25.4423, lon: -49.2490 },
    { name: 'Restaurante Universitário', desc: 'Ao lado do RU e da praça de alimentação', lat: -25.4437, lon: -49.2476 },
    { name: 'Ginásio Poliesportivo', desc: 'Junto ao ginásio e às quadras', lat: -25.4444, lon: -49.2465 },
    { name: 'Estacionamento Sul', desc: 'Estacionamento de alunos ao sul do campus', lat: -25.4450, lon: -49.2488 },
  ],
  cameras: [
    {
      code: 'PUC-CAM-001',
      name: 'Portaria Principal - Catracas',
      status: CameraStatus.online,
      model: 'Hikvision DS-2CD2143G2',
      ipAddress: '10.40.12.21',
      resolution: '1920x1080',
      fps: 30,
      lat: -25.4418,
      lon: -49.2479,
      locIdx: 0,
      binCode: null,
      lastSeenHoursAgo: 0,
      imageUrl: '/security/cameras/portaria-norte-entrada.jpg',
      notes: 'Cobertura da entrada principal e catracas.',
    },
    {
      code: 'PUC-CAM-002',
      name: 'Bloco Amarelo - Lixeira PUC-002',
      status: CameraStatus.online,
      model: 'Intelbras VIP 1230',
      ipAddress: '10.40.12.22',
      resolution: '1280x720',
      fps: 24,
      lat: -25.4427,
      lon: -49.2471,
      locIdx: null,
      binCode: 'PUC-002',
      lastSeenHoursAgo: 0,
      imageUrl: '/security/cameras/portaria-norte-lixeira.jpg',
      notes: 'Foco no ponto de descarte junto ao bloco amarelo.',
    },
    {
      code: 'PUC-CAM-003',
      name: 'Biblioteca Central - Visão geral',
      status: CameraStatus.maintenance,
      model: 'Dahua IPC-HFW2431S',
      ipAddress: '10.40.18.14',
      resolution: '1920x1080',
      fps: 25,
      lat: -25.4432,
      lon: -49.2482,
      locIdx: 2,
      binCode: null,
      lastSeenHoursAgo: 4,
      imageUrl: '/security/cameras/playground-central.jpg',
      notes: 'Aguardando ajuste de foco.',
    },
    {
      code: 'PUC-CAM-004',
      name: 'Restaurante Universitário - Lixeira PUC-008',
      status: CameraStatus.online,
      model: 'Axis M2035-LE',
      ipAddress: '10.40.22.9',
      resolution: '1920x1080',
      fps: 30,
      lat: -25.4438,
      lon: -49.2475,
      locIdx: null,
      binCode: 'PUC-008',
      lastSeenHoursAgo: 0,
      imageUrl: '/security/cameras/lago-ipes-deque.jpg',
      notes: 'Cobre a área do RU e da praça de alimentação.',
    },
    {
      code: 'PUC-CAM-005',
      name: 'Estacionamento Sul - Ponto 3',
      status: CameraStatus.offline,
      model: 'Intelbras VIP 3230',
      ipAddress: '10.40.24.33',
      resolution: '1280x720',
      fps: 20,
      lat: -25.4451,
      lon: -49.2487,
      locIdx: 6,
      binCode: null,
      lastSeenHoursAgo: 36,
      imageUrl: '/security/cameras/trilha-oeste-ponto-3.jpg',
      notes: 'Sem comunicação desde a noite anterior.',
    },
  ],
  bins: [
    { name: 'Lixeira Portaria A',          code: 'PUC-001', locIdx: 0, cap: 120, status: TrashBinStatus.active, fill: 41, battery: 88 },
    { name: 'Lixeira Bloco Amarelo',       code: 'PUC-002', locIdx: 1, cap: 100, status: TrashBinStatus.active, fill: 59, battery: 76 },
    { name: 'Lixeira Biblioteca',          code: 'PUC-003', locIdx: 2, cap: 80,  status: TrashBinStatus.full,  fill: 97, battery: 51 },
    { name: 'Lixeira Biblioteca Selet.',   code: 'PUC-004', locIdx: 2, cap: 60,  status: TrashBinStatus.active, fill: 47, battery: 82 },
    { name: 'Lixeira Reitoria',            code: 'PUC-005', locIdx: 3, cap: 100, status: TrashBinStatus.active, fill: 32, battery: 13 },
    { name: 'Lixeira Reitoria B',          code: 'PUC-006', locIdx: 3, cap: 150, status: TrashBinStatus.maintenance, fill: 23, battery: 67 },
    { name: 'Lixeira RU A',                code: 'PUC-007', locIdx: 4, cap: 100, status: TrashBinStatus.active, fill: 60, battery: 65 },
    { name: 'Lixeira RU B',                code: 'PUC-008', locIdx: 4, cap: 100, status: TrashBinStatus.offline, fill: null, battery: null },
    { name: 'Lixeira RU Selet.',           code: 'PUC-009', locIdx: 4, cap: 80,  status: TrashBinStatus.active, fill: 67, battery: 48 },
    { name: 'Lixeira Ginásio',             code: 'PUC-010', locIdx: 5, cap: 120, status: TrashBinStatus.active, fill: 30, battery: 87 },
    { name: 'Lixeira Ginásio B',           code: 'PUC-011', locIdx: 5, cap: 150, status: TrashBinStatus.active, fill: 82, battery: 59 },
    { name: 'Lixeira Estacionamento Sul',  code: 'PUC-012', locIdx: 6, cap: 100, status: TrashBinStatus.inactive, fill: null, battery: 32 },
  ],
};

async function main(): Promise<void> {
  console.log('Seeding database...');

  await prisma.notification.deleteMany();
  await prisma.task.deleteMany();
  await prisma.camera.deleteMany();
  await prisma.sensorReading.deleteMany();
  await prisma.trashBin.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.location.deleteMany();
  await prisma.site.deleteMany();

  await seedTenant(colecta);
  await seedTenant(disney);
  await seedTenant(centralParkZoo);
  await seedTenant(pucpr);

  console.log('\nSeed concluído.');
  console.log('Admin Colecta: admin@colecta.com / admin123');
  console.log('Usuários Colecta: carlos@, ana@, joao@, maria@, pedro@, beatriz@colecta.com — senha: funcionario123');
  console.log('Admin Disney: admin@disney.com / admin123');
  console.log('Usuários Disney: mickey@, minnie@, donald@, goofy@, pluto@, daisy@disney.com — senha: funcionario123');
  console.log('Admin Central Park Zoo: admin@centralpark.com / admin123');
  console.log('Usuários Central Park Zoo: james@, olivia@, william@, emma@, noah@, sophia@centralpark.com — senha: funcionario123');
  console.log('Admin PUCPR Curitiba: admin@pucpr.br / admin123');
  console.log('Usuários PUCPR Curitiba: lucas@, fernanda@, rafael@, juliana@, bruno@, camila@pucpr.br — senha: funcionario123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
