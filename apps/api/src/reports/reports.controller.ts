import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { ReportsService } from './reports.service';
import { getTenantUuid } from '../common/tenant.util';
import { Roles } from '../auth/roles.decorator';

@Controller('reports')
@Roles(UserRole.ADMIN)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('tasks.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="tasks.csv"')
  async tasksCsv(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('trashBinId') trashBinId?: string,
    @Query('startedById') startedById?: string,
  ) {
    return this.service.tasksCsv(getTenantUuid(req), {
      from,
      to,
      trashBinId,
      startedById,
    });
  }
}
