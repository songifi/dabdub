import { Controller, Get, Patch, Param, Req, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { NotificationService } from './notifications.service';
import { GetNotificationsQueryDto } from './dto/get-notifications.query';

interface RequestWithUser extends Request {
  user?: { id: string };
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({
    summary:
      'List notifications (cursor paginated); includes unread count header',
  })
  async list(
    @Req() req: RequestWithUser,
    @Query() query: GetNotificationsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    const userId = req.user!.id;
    const unreadCount = await this.notifications.getUnreadCount(userId);
    res.setHeader('X-Unread-Count', String(unreadCount));

    const { items, nextCursor } = await this.notifications.listForUser(userId, {
      limit: query.limit,
      cursor: query.cursor,
    });

    return { items, nextCursor };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async unreadCount(@Req() req: RequestWithUser): Promise<{ count: number }> {
    const userId = req.user!.id;
    const count = await this.notifications.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read (ownership enforced)' })
  async markRead(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<void> {
    const userId = req.user!.id;
    await this.notifications.markRead(userId, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  async markAllRead(@Req() req: RequestWithUser): Promise<void> {
    const userId = req.user!.id;
    await this.notifications.markAllRead(userId);
  }
}
