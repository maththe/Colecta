import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { TrashBinsModule } from './trash-bins/trash-bins.module';
import { SensorReadingsModule } from './sensor-readings/sensor-readings.module';
import { TasksModule } from './tasks/tasks.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TrashBinsModule,
    SensorReadingsModule,
    TasksModule,
    HealthModule,
  ],
})
export class AppModule {}
