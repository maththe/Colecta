import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { getTenantUuid } from '../common/tenant.util';
import { Roles } from '../auth/roles.decorator';
import { CamerasService } from './cameras.service';
import { CreateCameraDto } from './dto/create-camera.dto';

type AuthenticatedRequest = Request & {
  user?: {
    role?: UserRole;
  };
};

// Câmeras só podem ser visualizadas por ADMIN e SEGURANCA.
@Controller('cameras')
@Roles(UserRole.ADMIN, UserRole.SEGURANCA)
export class CamerasController {
  constructor(private readonly service: CamerasService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.service.findAll(getTenantUuid(req), req.user?.role);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.findOne(id, getTenantUuid(req), req.user?.role);
  }

  // Cadastro/remoção de câmeras é exclusivo do ADMIN (SEGURANCA só visualiza).
  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCameraDto, @Req() req: Request) {
    return this.service.create(dto, getTenantUuid(req));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.service.remove(id, getTenantUuid(req));
  }
}
