import { PrismaClient, TrashBinStatus, TaskStatus, TaskPriority, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const defaultTenantUuid = '00000000-0000-0000-0000-000000000001';
const defaultUsers = [
  {
    email: 'admin@colecta.com',
    name: 'Admin Colecta',
    password: 'admin123',
    role: UserRole.ADMIN,
  },
  {
    email: 'funcionario@colecta.com',
    name: 'Funcionario Colecta',
    password: 'funcionario123',
    role: UserRole.FUNCIONARIO,
  },
] as const;

async function main(): Promise<void> {
  console.log('Seeding database...');

  await prisma.task.deleteMany();
  await prisma.sensorReading.deleteMany();
  await prisma.trashBin.deleteMany();
  await prisma.location.deleteMany();

  for (const user of defaultUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password: await bcrypt.hash(user.password, 10),
        role: user.role,
        tenantUuid: defaultTenantUuid,
      },
      create: {
        email: user.email,
        name: user.name,
        password: await bcrypt.hash(user.password, 10),
        role: user.role,
        tenantUuid: defaultTenantUuid,
      },
    });
  }

  console.log('Usuarios padrao: admin@colecta.com/admin123 e funcionario@colecta.com/funcionario123.');

  const tenantUuid = defaultTenantUuid;

  const bins = await Promise.all([
    prisma.trashBin.create({
      data: {
        tenantUuid,
        name: 'Lixeira Entrada Norte',
        code: 'PRQ-001',
        location: {
          create: {
            tenantUuid,
            name: 'Entrada Norte',
            description: 'Próxima ao portão de entrada norte',
            latitude: -23.5874,
            longitude: -46.6576,
          },
        },
        capacityLiters: 120,
        status: TrashBinStatus.active,
        fillLevel: 35,
        batteryLevel: 87,
        lastSeenAt: new Date(),
      },
      include: { location: true },
    }),
    prisma.trashBin.create({
      data: {
        tenantUuid,
        name: 'Lixeira Playground',
        code: 'PRQ-002',
        location: {
          create: {
            tenantUuid,
            name: 'Playground',
            description: 'Ao lado do playground infantil',
            latitude: -23.5881,
            longitude: -46.6563,
          },
        },
        capacityLiters: 80,
        status: TrashBinStatus.full,
        fillLevel: 95,
        batteryLevel: 62,
        lastSeenAt: new Date(),
      },
      include: { location: true },
    }),
    prisma.trashBin.create({
      data: {
        tenantUuid,
        name: 'Lixeira Pista de Corrida',
        code: 'PRQ-003',
        location: {
          create: {
            tenantUuid,
            name: 'Pista de Corrida',
            description: 'Início da pista de corrida',
            latitude: -23.5892,
            longitude: -46.6588,
          },
        },
        capacityLiters: 100,
        status: TrashBinStatus.active,
        fillLevel: 48,
        batteryLevel: 12,
        lastSeenAt: new Date(),
      },
      include: { location: true },
    }),
    prisma.trashBin.create({
      data: {
        tenantUuid,
        name: 'Lixeira Quiosque Central',
        code: 'PRQ-004',
        location: {
          create: {
            tenantUuid,
            name: 'Quiosque Central',
            description: 'Atrás do quiosque central',
            latitude: -23.5868,
            longitude: -46.6594,
          },
        },
        capacityLiters: 150,
        status: TrashBinStatus.maintenance,
        fillLevel: 20,
        batteryLevel: 70,
        lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
      },
      include: { location: true },
    }),
    prisma.trashBin.create({
      data: {
        tenantUuid,
        name: 'Lixeira Lago',
        code: 'PRQ-005',
        location: {
          create: {
            tenantUuid,
            name: 'Lago',
            description: 'Margem leste do lago',
            latitude: -23.5901,
            longitude: -46.6552,
          },
        },
        capacityLiters: 100,
        status: TrashBinStatus.offline,
        fillLevel: null,
        batteryLevel: null,
        lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      },
      include: { location: true },
    }),
  ]);

  for (const bin of bins) {
    if (bin.fillLevel === null) continue;
    await prisma.sensorReading.create({
      data: {
        tenantUuid,
        trashBinId: bin.id,
        fillLevel: bin.fillLevel,
        batteryLevel: bin.batteryLevel,
        temperature: 24 + Math.random() * 6,
        latitude: bin.location.latitude,
        longitude: bin.location.longitude,
        payload: { source: 'seed' },
        receivedAt: bin.lastSeenAt ?? new Date(),
      },
    });
  }

  await prisma.task.createMany({
    data: [
      {
        tenantUuid,
        title: 'Esvaziar lixeira do playground',
        description: 'Lixeira PRQ-002 está cheia, ir até o local',
        status: TaskStatus.pending,
        priority: TaskPriority.high,
        trashBinId: bins[1].id,
        assigneeName: 'Equipe Coleta A',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 4),
      },
      {
        tenantUuid,
        title: 'Trocar bateria do sensor',
        description: 'Lixeira PRQ-003 com bateria baixa (12%)',
        status: TaskStatus.in_progress,
        priority: TaskPriority.medium,
        trashBinId: bins[2].id,
        assigneeName: 'Técnico Manutenção',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
      {
        tenantUuid,
        title: 'Verificar lixeira offline',
        description: 'PRQ-005 não envia leituras há 48h',
        status: TaskStatus.pending,
        priority: TaskPriority.urgent,
        trashBinId: bins[4].id,
        assigneeName: 'Técnico Manutenção',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 6),
      },
      {
        tenantUuid,
        title: 'Reunião semanal de operações',
        description: 'Revisar rotas e prioridades da semana',
        status: TaskStatus.pending,
        priority: TaskPriority.low,
        trashBinId: null,
        assigneeName: 'Gestor',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 72),
      },
    ],
  });

  console.log(`Seed concluído: ${bins.length} lixeiras criadas no tenant ${tenantUuid}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
