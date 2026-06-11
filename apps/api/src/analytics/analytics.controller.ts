import { Controller, Get, Query, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { getTenantUuid } from '../common/tenant.util';
import { Roles } from '../auth/roles.decorator';

@Controller('analytics')
@Roles(UserRole.ADMIN)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('summary')
  summary(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = this.service.buildRange(from, to);
    return this.service.summary(getTenantUuid(req), range);
  }

  @Get('productivity')
  productivity(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = this.service.buildRange(from, to);
    return this.service.productivity(getTenantUuid(req), range);
  }

  @Get('throughput')
  throughput(@Req() req: Request, @Query('weeks') weeks?: string) {
    const parsed = weeks ? Math.max(1, Math.min(52, parseInt(weeks, 10) || 12)) : 12;
    return this.service.throughput(getTenantUuid(req), parsed);
  }
}
