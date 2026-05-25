import { PrismaClient, TrashBinStatus, TaskStatus, TaskPriority } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  await prisma.task.deleteMany();
  await prisma.sensorReading.deleteMany();
  await prisma.trashBin.deleteMany();

  const bins = await Promise.all([
    prisma.trashBin.create({
      data: {
        name: 'Lixeira Entrada Norte',
        code: 'PRQ-001',
        locationDescription: 'Próxima ao portão de entrada norte',
        latitude: -23.5874,
        longitude: -46.6576,
        capacityLiters: 120,
        status: TrashBinStatus.active,
        fillLevel: 35,
        batteryLevel: 87,
        lastSeenAt: new Date(),
      },
    }),
    prisma.trashBin.create({
      data: {
        name: 'Lixeira Playground',
        code: 'PRQ-002',
        locationDescription: 'Ao lado do playground infantil',
        latitude: -23.5881,
        longitude: -46.6563,
        capacityLiters: 80,
        status: TrashBinStatus.full,
        fillLevel: 95,
        batteryLevel: 62,
        lastSeenAt: new Date(),
      },
    }),
    prisma.trashBin.create({
      data: {
        name: 'Lixeira Pista de Corrida',
        code: 'PRQ-003',
        locationDescription: 'Início da pista de corrida',
        latitude: -23.5892,
        longitude: -46.6588,
        capacityLiters: 100,
        status: TrashBinStatus.active,
        fillLevel: 48,
        batteryLevel: 12,
        lastSeenAt: new Date(),
      },
    }),
    prisma.trashBin.create({
      data: {
        name: 'Lixeira Quiosque Central',
        code: 'PRQ-004',
        locationDescription: 'Atrás do quiosque central',
        latitude: -23.5868,
        longitude: -46.6594,
        capacityLiters: 150,
        status: TrashBinStatus.maintenance,
        fillLevel: 20,
        batteryLevel: 70,
        lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
      },
    }),
    prisma.trashBin.create({
      data: {
        name: 'Lixeira Lago',
        code: 'PRQ-005',
        locationDescription: 'Margem leste do lago',
        latitude: -23.5901,
        longitude: -46.6552,
        capacityLiters: 100,
        status: TrashBinStatus.offline,
        fillLevel: null,
        batteryLevel: null,
        lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      },
    }),
  ]);

  for (const bin of bins) {
    if (bin.fillLevel === null) continue;
    await prisma.sensorReading.create({
      data: {
        trashBinId: bin.id,
        fillLevel: bin.fillLevel,
        batteryLevel: bin.batteryLevel,
        temperature: 24 + Math.random() * 6,
        latitude: bin.latitude,
        longitude: bin.longitude,
        payload: { source: 'seed' },
        receivedAt: bin.lastSeenAt ?? new Date(),
      },
    });
  }

  await prisma.task.createMany({
    data: [
      {
        title: 'Esvaziar lixeira do playground',
        description: 'Lixeira PRQ-002 está cheia, ir até o local',
        status: TaskStatus.pending,
        priority: TaskPriority.high,
        trashBinId: bins[1].id,
        assigneeName: 'Equipe Coleta A',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 4),
      },
      {
        title: 'Trocar bateria do sensor',
        description: 'Lixeira PRQ-003 com bateria baixa (12%)',
        status: TaskStatus.in_progress,
        priority: TaskPriority.medium,
        trashBinId: bins[2].id,
        assigneeName: 'Técnico Manutenção',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
      {
        title: 'Verificar lixeira offline',
        description: 'PRQ-005 não envia leituras há 48h',
        status: TaskStatus.pending,
        priority: TaskPriority.urgent,
        trashBinId: bins[4].id,
        assigneeName: 'Técnico Manutenção',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 6),
      },
      {
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

  console.log(`Seed concluído: ${bins.length} lixeiras criadas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
