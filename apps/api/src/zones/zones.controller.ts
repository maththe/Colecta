import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { getTenantUuid } from '../common/tenant.util';
import { Roles } from '../auth/roles.decorator';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { ZonesService } from './zones.service';

type AuthenticatedRequest = Request & { user?: { role?: UserRole } };

@Controller('zones')
export class ZonesController {
  constructor(private readonly service: ZonesService) {}

  // Leitura liberada a qualquer papel autenticado (o mapa exibe as zonas). O
  // papel vai junto porque a contagem de tarefas abertas é filtrada por equipe.
  @Get()
  findAll(@Req() req: AuthenticatedRequest, @Query('siteId') siteId?: string) {
    return this.service.findAll(getTenantUuid(req), siteId, req.user?.role);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.service.findOne(id, getTenantUuid(req));
  }

  // Escrita das zonas (contorno, cor, categoria) é só do ADMIN.
  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateZoneDto, @Req() req: Request) {
    return this.service.create(dto, getTenantUuid(req));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateZoneDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, getTenantUuid(req));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.service.remove(id, getTenantUuid(req));
  }
}
