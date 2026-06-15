import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { AutomationService } from './automation.service';
import { AutomationCron } from './automation.cron';

@Module({
  imports: [TasksModule],
  providers: [AutomationService, AutomationCron],
  exports: [AutomationService],
})
export class AutomationModule {}
