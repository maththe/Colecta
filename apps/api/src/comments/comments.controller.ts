import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CommentsService } from './comments.service';
import { getTenantUuid } from '../common/tenant.util';

type AuthenticatedRequest = Request & { user?: { sub?: string } };

@Controller('tasks/:taskId/comments')
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  @Get()
  list(
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Req() req: Request,
  ) {
    return this.service.list(taskId, getTenantUuid(req));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() body: { body?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(
      taskId,
      getTenantUuid(req),
      req.user?.sub,
      body?.body ?? '',
    );
  }
}
