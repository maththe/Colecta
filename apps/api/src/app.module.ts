import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { TrashBinsModule } from './trash-bins/trash-bins.module';
import { LocationsModule } from './locations/locations.module';
import { SensorReadingsModule } from './sensor-readings/sensor-readings.module';
import { TasksModule } from './tasks/tasks.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuthGuard } from './auth/auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { AutomationModule } from './automation/automation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    LocationsModule,
    TrashBinsModule,
    SensorReadingsModule,
    TasksModule,
    AutomationModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
