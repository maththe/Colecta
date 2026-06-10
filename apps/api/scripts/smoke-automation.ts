import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AutomationService } from '../src/automation/automation.service';
import { PrismaService } from '../src/prisma/prisma.service';

const TENANT = '00000000-0000-0000-0000-000000000001';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const automation = app.get(AutomationService);

  function divider(label: string): void {
    console.log(`\n=== ${label} ===`);
  }

  async function dumpTasks(label: string, binId: string): Promise<void> {
    const tasks = await prisma.task.findMany({
      where: { tenantUuid: TENANT, trashBinId: binId },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`[${label}] tarefas para bin=${binId.slice(0, 8)}: ${tasks.length}`);
    for (const t of tasks) {
      console.log(`  - ${t.title} | kind=${t.kind} status=${t.status} priority=${t.priority} issues=${JSON.stringify(t.issues)}`);
    }
  }

  const bin = await prisma.trashBin.findFirst({
    where: { tenantUuid: TENANT, code: 'PRQ-001' },
  });
  if (!bin) throw new Error('PRQ-001 não encontrada — rode o seed primeiro');

  divider('Estado inicial');
  await dumpTasks('inicial', bin.id);

  divider('Cenario 1: leitura com fillLevel=95');
  await prisma.trashBin.update({
    where: { id: bin.id },
    data: { fillLevel: 95, batteryLevel: 80, lastSeenAt: new Date(), status: 'full' },
  });
  await automation.evaluateBin(bin.id, TENANT);
  await dumpTasks('apos cheia', bin.id);

  divider('Cenario 2: nova leitura fill=96 — dedup esperado');
  await automation.evaluateBin(bin.id, TENANT);
  await dumpTasks('apos cheia repetida', bin.id);

  divider('Cenario 3: bateria desce para 10% — task deve ganhar issue battery');
  await prisma.trashBin.update({
    where: { id: bin.id },
    data: { batteryLevel: 10 },
  });
  await automation.evaluateBin(bin.id, TENANT);
  await dumpTasks('apos cheia+bateria', bin.id);

  divider('Cenario 4: lastSeenAt antigo (offline) — issue offline soma');
  await prisma.trashBin.update({
    where: { id: bin.id },
    data: { lastSeenAt: new Date(Date.now() - 26 * 60 * 60 * 1000) },
  });
  await automation.evaluateBin(bin.id, TENANT);
  await dumpTasks('apos offline', bin.id);

  divider('Cenario 5: normalizacao — task segue aberta, sem issues');
  await prisma.trashBin.update({
    where: { id: bin.id },
    data: { fillLevel: 30, batteryLevel: 80, lastSeenAt: new Date(), status: 'active' },
  });
  await automation.evaluateBin(bin.id, TENANT);
  await dumpTasks('apos normalizar', bin.id);

  divider('Cenario 6: marca tarefa como done, novo problema cria nova');
  const open = await prisma.task.findFirst({
    where: { tenantUuid: TENANT, trashBinId: bin.id, kind: 'auto', status: 'pending' },
  });
  if (open) {
    await prisma.task.update({ where: { id: open.id }, data: { status: 'done' } });
    console.log(`  fechei tarefa ${open.id.slice(0, 8)}`);
  }
  await prisma.trashBin.update({
    where: { id: bin.id },
    data: { fillLevel: 95, lastSeenAt: new Date(), status: 'full' },
  });
  await automation.evaluateBin(bin.id, TENANT);
  await dumpTasks('apos fechamento+novo problema', bin.id);

  divider('Cenario 7: evaluateAllBins (caminho do cron)');
  await automation.evaluateAllBins();
  const allAuto = await prisma.task.findMany({
    where: { tenantUuid: TENANT, kind: 'auto', status: { in: ['pending', 'in_progress'] } },
    include: { trashBin: { select: { code: true } } },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`  tarefas auto abertas no tenant: ${allAuto.length}`);
  for (const t of allAuto) {
    console.log(`  - bin=${t.trashBin?.code} title=${t.title} issues=${JSON.stringify(t.issues)} priority=${t.priority}`);
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
