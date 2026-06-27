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
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { getTenantUuid } from '../common/tenant.util';
import { Roles } from '../auth/roles.decorator';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SitesService } from './sites.service';

@Controller('sites')
export class SitesController {
  constructor(private readonly service: SitesService) {}

  // Leitura liberada a qualquer papel autenticado (o mapa precisa do recinto).
  @Get()
  findAll(@Req() req: Request) {
    return this.service.findAll(getTenantUuid(req));
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.service.findOne(id, getTenantUuid(req));
  }

  // Escrita do recinto (contorno, baseMode) é só do ADMIN.
  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSiteDto, @Req() req: Request) {
    return this.service.create(dto, getTenantUuid(req));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSiteDto,
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
