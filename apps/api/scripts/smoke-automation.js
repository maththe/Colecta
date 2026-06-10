/* eslint-disable */
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { AutomationService } = require('../dist/automation/automation.service');
const { PrismaService } = require('../dist/prisma/prisma.service');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const automation = app.get(AutomationService);

  const bin = await prisma.trashBin.findFirst({ where: { code: 'PRQ-001' } });
  if (!bin) throw new Error('PRQ-001 nao encontrada');
  const TENANT = bin.tenantUuid;
  console.log(`Usando tenant=${TENANT} bin=${bin.id}`);

  function divider(label) {
    console.log(`\n=== ${label} ===`);
  }

  async function dumpTasks(label, binId) {
    const tasks = await prisma.task.findMany({
      where: { tenantUuid: TENANT, trashBinId: binId },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`[${label}] tarefas bin=${binId.slice(0, 8)}: ${tasks.length}`);
    for (const t of tasks) {
      console.log(`  - ${t.title} | kind=${t.kind} status=${t.status} priority=${t.priority} issues=${JSON.stringify(t.issues)}`);
    }
  }

  divider('Estado inicial');
  await dumpTasks('inicial', bin.id);

  divider('Cenario 1: fillLevel=95');
  await prisma.trashBin.update({
    where: { id: bin.id },
    data: { fillLevel: 95, batteryLevel: 80, lastSeenAt: new Date(), status: 'full' },
  });
  await automation.evaluateBin(bin.id, TENANT);
  await dumpTasks('apos cheia', bin.id);

  divider('Cenario 2: dedup (fill ainda 95)');
  await automation.evaluateBin(bin.id, TENANT);
  await dumpTasks('apos repeticao', bin.id);

  divider('Cenario 3: bateria 10% (cheia + bateria)');
  await prisma.trashBin.update({ where: { id: bin.id }, data: { batteryLevel: 10 } });
  await automation.evaluateBin(bin.id, TENANT);
  await dumpTasks('apos cheia+bateria', bin.id);

  divider('Cenario 4: offline (lastSeenAt -26h)');
  await prisma.trashBin.update({
    where: { id: bin.id },
    data: { lastSeenAt: new Date(Date.now() - 26 * 60 * 60 * 1000) },
  });
  await automation.evaluateBin(bin.id, TENANT);
  await dumpTasks('apos offline', bin.id);

  divider('Cenario 5: normalizacao');
  await prisma.trashBin.update({
    where: { id: bin.id },
    data: { fillLevel: 30, batteryLevel: 80, lastSeenAt: new Date(), status: 'active' },
  });
  await automation.evaluateBin(bin.id, TENANT);
  await dumpTasks('apos normalizar', bin.id);

  divider('Cenario 6: fechar tarefa + novo problema');
  const open = await prisma.task.findFirst({
    where: { tenantUuid: TENANT, trashBinId: bin.id, kind: 'auto', status: 'pending' },
  });
  if (open) {
    await prisma.task.update({ where: { id: open.id }, data: { status: 'done' } });
    console.log(`  fechei ${open.id.slice(0, 8)}`);
  }
  await prisma.trashBin.update({
    where: { id: bin.id },
    data: { fillLevel: 95, lastSeenAt: new Date(), status: 'full' },
  });
  await automation.evaluateBin(bin.id, TENANT);
  await dumpTasks('apos fechamento+novo', bin.id);

  divider('Cenario 7: evaluateAllBins (cron)');
  await automation.evaluateAllBins();
  const allAuto = await prisma.task.findMany({
    where: { tenantUuid: TENANT, kind: 'auto', status: { in: ['pending', 'in_progress'] } },
    include: { trashBin: { select: { code: true } } },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`  tarefas auto abertas: ${allAuto.length}`);
  for (const t of allAuto) {
    console.log(`  - bin=${t.trashBin?.code} title=${t.title} issues=${JSON.stringify(t.issues)} priority=${t.priority}`);
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
