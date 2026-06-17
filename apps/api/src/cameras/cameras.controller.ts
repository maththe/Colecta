import { Controller, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { getTenantUuid } from '../common/tenant.util';
import { Roles } from '../auth/roles.decorator';
import { CamerasService } from './cameras.service';

// Câmeras só podem ser visualizadas por ADMIN e SEGURANCA.
@Controller('cameras')
@Roles(UserRole.ADMIN, UserRole.SEGURANCA)
export class CamerasController {
  constructor(private readonly service: CamerasService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.service.findAll(getTenantUuid(req));
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.service.findOne(id, getTenantUuid(req));
  }
}
