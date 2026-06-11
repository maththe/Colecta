import {
  Controller,
  ForbiddenException,
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
import { NotificationsService } from './notifications.service';
import { getTenantUuid } from '../common/tenant.util';

type AuthenticatedRequest = Request & { user?: { sub?: string } };

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest, @Query('unread') unread?: string) {
    const userId = this.requireUserId(req);
    return this.service.listForUser(
      userId,
      getTenantUuid(req),
      unread === 'true' || unread === '1',
    );
  }

  @Get('unread-count')
  async unreadCount(@Req() req: AuthenticatedRequest) {
    const userId = this.requireUserId(req);
    const count = await this.service.unreadCount(userId, getTenantUuid(req));
    return { count };
  }

  @Patch(':id/read')
  markRead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = this.requireUserId(req);
    return this.service.markRead(id, userId, getTenantUuid(req));
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(@Req() req: AuthenticatedRequest) {
    const userId = this.requireUserId(req);
    return this.service.markAllRead(userId, getTenantUuid(req));
  }

  private requireUserId(req: AuthenticatedRequest): string {
    const sub = req.user?.sub;
    if (!sub) throw new ForbiddenException('Usuário não identificado.');
    return sub;
  }
}
