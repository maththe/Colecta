import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { ReportsService } from './reports.service';
import { TasksReportQueryDto } from './dto/tasks-report-query.dto';
import { getTenantUuid } from '../common/tenant.util';
import { Roles } from '../auth/roles.decorator';

@Controller('reports')
@Roles(UserRole.ADMIN)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('tasks.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="tasks.csv"')
  async tasksCsv(@Req() req: Request, @Query() query: TasksReportQueryDto) {
    return this.service.tasksCsv(getTenantUuid(req), {
      from: query.from,
      to: query.to,
      trashBinId: query.trashBinId,
      startedById: query.startedById,
    });
  }
}
