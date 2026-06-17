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
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { CreateSecurityOccurrenceDto } from './dto/create-security-occurrence.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { getTenantUuid } from '../common/tenant.util';
import { Roles } from '../auth/roles.decorator';
import { EMPLOYEE_ROLES } from '../auth/role-groups';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    role?: UserRole;
  };
};

const TASK_VIEWER_ROLES = [UserRole.ADMIN, ...EMPLOYEE_ROLES];

@Controller('tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.service.findAll(getTenantUuid(req), req.user?.role);
  }

  // Marcadores de tarefa do mapa: filtrados por equipe no servidor. Precisa vir
  // antes de ':id' para não ser capturado pela rota com parâmetro.
  @Get('map')
  @Roles(...TASK_VIEWER_ROLES)
  findMapTasks(@Req() req: AuthenticatedRequest) {
    return this.service.findMapTasks(getTenantUuid(req), req.user?.role);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.service.findOne(id, getTenantUuid(req));
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTaskDto, @Req() req: Request) {
    return this.service.create(dto, getTenantUuid(req));
  }

  @Post('security-occurrences')
  @Roles(UserRole.ADMIN, ...EMPLOYEE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  createSecurityOccurrence(
    @Body() dto: CreateSecurityOccurrenceDto,
    @Req() req: Request,
  ) {
    return this.service.createSecurityOccurrence(dto, getTenantUuid(req));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, ...EMPLOYEE_ROLES)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, getTenantUuid(req), req.user?.role, req.user?.sub);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.service.remove(id, getTenantUuid(req));
  }
}
