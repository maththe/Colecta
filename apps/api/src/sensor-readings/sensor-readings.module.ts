import { Module } from '@nestjs/common';
import { SensorReadingsService } from './sensor-readings.service';
import { SensorReadingsController } from './sensor-readings.controller';
import { AutomationModule } from '../automation/automation.module';

@Module({
  imports: [AutomationModule],
  controllers: [SensorReadingsController],
  providers: [SensorReadingsService],
})
export class SensorReadingsModule {}
