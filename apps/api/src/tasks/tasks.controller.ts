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
import { UpdateTaskDto } from './dto/update-task.dto';
import { getTenantUuid } from '../common/tenant.util';
import { Roles } from '../auth/roles.decorator';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    role?: UserRole;
  };
};

@Controller('tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.service.findAll(getTenantUuid(req));
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

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.FUNCIONARIO)
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
