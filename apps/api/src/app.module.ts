import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { SitesModule } from './sites/sites.module';
import { ZonesModule } from './zones/zones.module';
import { TrashBinsModule } from './trash-bins/trash-bins.module';
import { LocationsModule } from './locations/locations.module';
import { CamerasModule } from './cameras/cameras.module';
import { SensorReadingsModule } from './sensor-readings/sensor-readings.module';
import { TasksModule } from './tasks/tasks.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuthGuard } from './auth/auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { AutomationModule } from './automation/automation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MailerModule } from './mailer/mailer.module';
import { ReportsModule } from './reports/reports.module';
import { MqttIngestModule } from './mqtt-ingest/mqtt-ingest.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    SitesModule,
    ZonesModule,
    LocationsModule,
    CamerasModule,
    TrashBinsModule,
    SensorReadingsModule,
    TasksModule,
    AutomationModule,
    NotificationsModule,
    AnalyticsModule,
    MailerModule,
    ReportsModule,
    MqttIngestModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
