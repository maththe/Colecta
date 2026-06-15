import { PrismaClient, TrashBinStatus, TaskStatus, TaskPriority, TaskKind, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const TENANT = '00000000-0000-0000-0000-000000000001';
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

async function main(): Promise<void> {
  console.log('Seeding database...');

  await prisma.notification.deleteMany();
  await prisma.task.deleteMany();
  await prisma.sensorReading.deleteMany();
  await prisma.trashBin.deleteMany();
  await prisma.location.deleteMany();

  const hashedAdmin = await bcrypt.hash('admin123', 10);
  const hashedFunc = await bcrypt.hash('funcionario123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@colecta.com' },
    update: { name: 'Admin Colecta', password: hashedAdmin, role: UserRole.ADMIN, tenantUuid: TENANT },
    create: { email: 'admin@colecta.com', name: 'Admin Colecta', password: hashedAdmin, role: UserRole.ADMIN, tenantUuid: TENANT },
  });

  const employeeDefs = [
    { email: 'carlos@colecta.com', name: 'Carlos Silva', onTimeRate: 0.88 },
    { email: 'ana@colecta.com', name: 'Ana Souza', onTimeRate: 0.93 },
    { email: 'joao@colecta.com', name: 'João Oliveira', onTimeRate: 0.71 },
    { email: 'maria@colecta.com', name: 'Maria Santos', onTimeRate: 0.85 },
    { email: 'pedro@colecta.com', name: 'Pedro Costa', onTimeRate: 0.78 },
    { email: 'beatriz@colecta.com', name: 'Beatriz Lima', onTimeRate: 0.96 },
  ];

  const employees = await Promise.all(
    employeeDefs.map(async (e) => {
      const user = await prisma.user.upsert({
        where: { email: e.email },
        update: { name: e.name, password: hashedFunc, role: UserRole.FUNCIONARIO, tenantUuid: TENANT },
        create: { email: e.email, name: e.name, password: hashedFunc, role: UserRole.FUNCIONARIO, tenantUuid: TENANT },
      });
      return { ...user, onTimeRate: e.onTimeRate };
    }),
  );

  const locationDefs = [
    { name: 'Entrada Norte', desc: 'Próxima ao portão de entrada norte', lat: -23.5874, lon: -46.6576 },
    { name: 'Playground', desc: 'Ao lado do playground infantil', lat: -23.5881, lon: -46.6563 },
    { name: 'Pista de Corrida', desc: 'Início da pista de corrida', lat: -23.5892, lon: -46.6588 },
    { name: 'Quiosque Central', desc: 'Atrás do quiosque central', lat: -23.5868, lon: -46.6594 },
    { name: 'Lago', desc: 'Margem leste do lago', lat: -23.5901, lon: -46.6552 },
    { name: 'Bosque Sul', desc: 'Área arborizada ao sul do parque', lat: -23.5915, lon: -46.6570 },
    { name: 'Arena de Esportes', desc: 'Quadras poliesportivas', lat: -23.5858, lon: -46.6600 },
  ];

  const locations = await Promise.all(
    locationDefs.map((l) =>
      prisma.location.create({
        data: { tenantUuid: TENANT, name: l.name, description: l.desc, latitude: l.lat, longitude: l.lon },
      }),
    ),
  );

  const binDefs = [
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
  ];

  const now = new Date();

  const bins = await Promise.all(
    binDefs.map((b) =>
      prisma.trashBin.create({
        data: {
          tenantUuid: TENANT,
          name: b.name,
          code: b.code,
          locationId: locations[b.locIdx].id,
          capacityLiters: b.cap,
          status: b.status,
          fillLevel: b.fill,
          batteryLevel: b.battery,
          mqttTopic: b.code === 'PRQ-001' ? 'binovate/medidas' : null,
          distanceEmptyCm: b.code === 'PRQ-001' ? 80 : null,
          distanceFullCm: b.code === 'PRQ-001' ? 10 : null,
          lastSeenAt:
            b.status === TrashBinStatus.offline
              ? new Date(now.getTime() - 48 * HOUR_MS)
              : now,
        },
      }),
    ),
  );

  // Sensor readings: 4 weeks of readings for bins that have fill data
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
    const def = binDefs[binIdx];
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
  console.log(`Created ${sensorRows.length} sensor readings`);

  // Historical tasks: 12 weeks, ~15 tasks/week = ~180 total
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

  const priorities = [
    TaskPriority.low,
    TaskPriority.medium,
    TaskPriority.medium,
    TaskPriority.high,
    TaskPriority.urgent,
  ];

  const historyRows: {
    tenantUuid: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    kind: TaskKind;
    trashBinId: string;
    locationId: string;
    startedById: string;
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

      const emp = employees[counter % employees.length];
      const isOnTime = (counter % 100) < Math.round(emp.onTimeRate * 100);
      const dueDateOffset = isOnTime
        ? (1 + (counter % 3)) * HOUR_MS
        : -(1 + (counter % 2)) * HOUR_MS;
      const dueDate = new Date(completedAt.getTime() + dueDateOffset);

      const binIdx = counter % bins.length;
      const bin = bins[binIdx];
      const locIdx = binDefs[binIdx].locIdx;
      const title = `${taskTitles[counter % taskTitles.length]} – ${binDefs[binIdx].code}`;

      historyRows.push({
        tenantUuid: TENANT,
        title,
        status: TaskStatus.done,
        priority: priorities[counter % priorities.length],
        kind: TaskKind.manual,
        trashBinId: bin.id,
        locationId: locations[locIdx].id,
        startedById: emp.id,
        assigneeName: emp.name,
        dueDate,
        startedAt,
        completedAt,
        createdAt,
        updatedAt: completedAt,
      });
    }
  }

  await prisma.task.createMany({ data: historyRows });
  console.log(`Created ${historyRows.length} historical tasks`);

  // Current open tasks
  await prisma.task.createMany({
    data: [
      {
        tenantUuid: TENANT,
        title: 'Esvaziar PRQ-003 (lixeira cheia)',
        description: 'Lixeira do playground está com 97% — precisa de coleta urgente.',
        status: TaskStatus.pending,
        priority: TaskPriority.urgent,
        trashBinId: bins[2].id,
        locationId: locations[1].id,
        assigneeName: employees[0].name,
        dueDate: new Date(now.getTime() + 2 * HOUR_MS),
      },
      {
        tenantUuid: TENANT,
        title: 'Trocar bateria sensor PRQ-005',
        description: 'Bateria em 12%, risco de perda de sinal.',
        status: TaskStatus.in_progress,
        priority: TaskPriority.high,
        trashBinId: bins[4].id,
        locationId: locations[2].id,
        startedById: employees[2].id,
        startedAt: new Date(now.getTime() - 2 * HOUR_MS),
        assigneeName: employees[2].name,
        dueDate: new Date(now.getTime() + 4 * HOUR_MS),
      },
      {
        tenantUuid: TENANT,
        title: 'Verificar lixeira offline PRQ-008',
        description: 'Sem leituras de sensor há 48h.',
        status: TaskStatus.pending,
        priority: TaskPriority.urgent,
        trashBinId: bins[7].id,
        locationId: locations[4].id,
        assigneeName: employees[1].name,
        dueDate: new Date(now.getTime() + HOUR_MS),
      },
      {
        tenantUuid: TENANT,
        title: 'Manutenção compartimento PRQ-006',
        description: 'Reparar dobradiça danificada.',
        status: TaskStatus.in_progress,
        priority: TaskPriority.medium,
        trashBinId: bins[5].id,
        locationId: locations[3].id,
        startedById: employees[4].id,
        startedAt: new Date(now.getTime() - 5 * HOUR_MS),
        assigneeName: employees[4].name,
        dueDate: new Date(now.getTime() + 3 * DAY_MS),
      },
      {
        tenantUuid: TENANT,
        title: 'Coletar lixo acumulado PRQ-011',
        description: 'Arena A com 82% — próximo do limite.',
        status: TaskStatus.pending,
        priority: TaskPriority.high,
        trashBinId: bins[10].id,
        locationId: locations[6].id,
        assigneeName: employees[3].name,
        dueDate: daysAgo(1),
      },
      {
        tenantUuid: TENANT,
        title: 'Inspeção semanal da frota',
        description: 'Revisão quinzenal de todas as lixeiras do parque.',
        status: TaskStatus.pending,
        priority: TaskPriority.low,
        dueDate: new Date(now.getTime() + 2 * DAY_MS),
      },
    ],
  });

  console.log(`Seed concluído: ${bins.length} lixeiras, ${employees.length} funcionários, ${historyRows.length} tarefas históricas.`);
  console.log('Admin: admin@colecta.com / admin123');
  console.log('Funcionários: carlos@colecta.com, ana@colecta.com, joao@colecta.com, maria@colecta.com, pedro@colecta.com, beatriz@colecta.com — senha: funcionario123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
