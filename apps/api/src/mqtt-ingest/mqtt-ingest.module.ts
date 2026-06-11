import { Module } from '@nestjs/common';
import { SensorReadingsModule } from '../sensor-readings/sensor-readings.module';
import { MqttIngestService } from './mqtt-ingest.service';

@Module({
  imports: [SensorReadingsModule],
  providers: [MqttIngestService],
})
export class MqttIngestModule {}
