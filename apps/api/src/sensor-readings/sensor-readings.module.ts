import { Module } from '@nestjs/common';
import { SensorReadingsController } from './sensor-readings.controller';
import { SensorReadingsService } from './sensor-readings.service';

@Module({
  controllers: [SensorReadingsController],
  providers: [SensorReadingsService],
})
export class SensorReadingsModule {}
