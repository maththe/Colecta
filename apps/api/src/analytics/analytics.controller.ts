import { Controller, Get, Query, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { ThroughputQueryDto } from './dto/throughput-query.dto';
import { BinsQueryDto } from './dto/bins-query.dto';
import { RangeQueryDto } from '../common/dto/range-query.dto';
import { getTenantUuid } from '../common/tenant.util';
import { Roles } from '../auth/roles.decorator';

@Controller('analytics')
@Roles(UserRole.ADMIN)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('summary')
  summary(@Req() req: Request, @Query() query: RangeQueryDto) {
    const range = this.service.buildRange(query.from, query.to);
    return this.service.summary(getTenantUuid(req), range);
  }

  @Get('productivity')
  productivity(@Req() req: Request, @Query() query: RangeQueryDto) {
    const range = this.service.buildRange(query.from, query.to);
    return this.service.productivity(getTenantUuid(req), range);
  }

  @Get('throughput')
  throughput(@Req() req: Request, @Query() query: ThroughputQueryDto) {
    return this.service.throughput(getTenantUuid(req), query.weeks);
  }

  @Get('bins')
  binActivity(@Req() req: Request, @Query() query: BinsQueryDto) {
    // groupBy=zone → distribuição das lixeiras por zona (zoneId persistido).
    if (query.groupBy === 'zone') {
      return this.service.binsByZone(getTenantUuid(req), query.siteId);
    }
    const range = this.service.buildRange(query.from, query.to);
    return this.service.binActivity(getTenantUuid(req), range);
  }
}
