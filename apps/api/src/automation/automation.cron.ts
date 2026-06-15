import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AutomationService } from './automation.service';

@Injectable()
export class AutomationCron {
  private readonly logger = new Logger(AutomationCron.name);

  constructor(private readonly automation: AutomationService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async tick(): Promise<void> {
    this.logger.debug('Avaliando lixeiras para automação de tarefas');
    await this.automation.evaluateAllBins();
  }
}
