import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { detectIssues } from './rules';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
  ) {}

  async evaluateBin(trashBinId: string, tenantUuid: string): Promise<void> {
    const bin = await this.prisma.trashBin.findFirst({
      where: { id: trashBinId, tenantUuid },
    });
    if (!bin) return;

    const issues = detectIssues(bin, new Date());
    await this.tasks.upsertAutoTask({ tenantUuid, bin, issues });
  }

  async evaluateAllBins(): Promise<void> {
    const bins = await this.prisma.trashBin.findMany({
      select: { id: true, tenantUuid: true },
    });
    for (const bin of bins) {
      try {
        await this.evaluateBin(bin.id, bin.tenantUuid);
      } catch (err) {
        this.logger.error(
          `Falha ao avaliar lixeira ${bin.id} do tenant ${bin.tenantUuid}: ${(err as Error).message}`,
        );
      }
    }
  }
}
