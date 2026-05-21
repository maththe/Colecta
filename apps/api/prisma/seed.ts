import { PrismaClient, TaskPriority, TaskStatus, TrashBinStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.task.deleteMany();
  await prisma.sensorReading.deleteMany();
  await prisma.trashBin.deleteMany();

  const bins = await Promise.all([
    prisma.trashBin.create({
      data: {
        name: 'Lixeira Quiosque Central',
        code: 'PRQ-001',
        locationDescription: 'Próxima ao quiosque central do parque',
        latitude: -23.5616,
        longitude: -46.6559,
        capacityLiters: 120,
        status: TrashBinStatus.active,
        fillLevel: 42,
        batteryLevel: 88,
        lastSeenAt: new Date(),
      },
    }),
    prisma.trashBin.create({
      data: {
        name: 'Lixeira Entrada Norte',
        code: 'PRQ-002',
        locationDescription: 'Portão de entrada norte',
        latitude: -23.5601,
        longitude: -46.6571,
        capacityLiters: 240,
        status: TrashBinStatus.full,
        fillLevel: 96,
        batteryLevel: 67,
        lastSeenAt: new Date(),
      },
    }),
    prisma.trashBin.create({
      data: {
        name: 'Lixeira Playground',
        code: 'PRQ-003',
        locationDescription: 'Ao lado do playground infantil',
        latitude: -23.5625,
        longitude: -46.6544,
        capacityLiters: 80,
        status: TrashBinStatus.active,
        fillLevel: 35,
        batteryLevel: 12,
        lastSeenAt: new Date(),
      },
    }),
    prisma.trashBin.create({
      data: {
        name: 'Lixeira Pista de Caminhada',
        code: 'PRQ-004',
        locationDescription: 'Próxima ao km 1 da pista',
        latitude: -23.5638,
        longitude: -46.6588,
        capacityLiters: 100,
        status: TrashBinStatus.maintenance,
        fillLevel: 18,
        batteryLevel: 54,
        lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
      },
    }),
    prisma.trashBin.create({
      data: {
        name: 'Lixeira Estacionamento',
        code: 'PRQ-005',
        locationDescription: 'Setor C do estacionamento',
        latitude: -23.5592,
        longitude: -46.6532,
        capacityLiters: 240,
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
        temperature: 24 + Math.random() * 5,
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
        title: 'Esvaziar lixeira da entrada norte',
        description: 'Lixeira atingiu 96% de preenchimento',
        status: TaskStatus.pending,
        priority: TaskPriority.high,
        trashBinId: bins[1].id,
        assigneeName: 'Equipe A',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 4),
      },
      {
        title: 'Trocar bateria da lixeira do playground',
        description: 'Bateria em 12%',
        status: TaskStatus.in_progress,
        priority: TaskPriority.urgent,
        trashBinId: bins[2].id,
        assigneeName: 'Manutenção',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
      {
        title: 'Verificar lixeira offline no estacionamento',
        description: 'Sem comunicação há 48h',
        status: TaskStatus.pending,
        priority: TaskPriority.medium,
        trashBinId: bins[4].id,
        assigneeName: 'Equipe B',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 12),
      },
      {
        title: 'Revisar rota de coleta vespertina',
        description: 'Otimização semanal de rotas',
        status: TaskStatus.pending,
        priority: TaskPriority.low,
        trashBinId: null,
        assigneeName: 'Coordenação',
        dueDate: null,
      },
    ],
  });

  console.log('Seed concluído.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
