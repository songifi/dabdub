import {
  Controller,
  Get,
  Patch,
  Param,
  Req,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiHeader,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { NotificationService } from './notifications.service';
import { GetNotificationsQueryDto } from './dto/get-notifications.query';
import {
  NotificationsListResponseDto,
  UnreadCountResponseDto,
} from './dto/notification-response.dto';

interface RequestWithUser extends Request {
  user?: { id: string };
}

@ApiTags('notifications')
@ApiBearerAuth('bearer')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({
    summary: 'List notifications (cursor paginated); includes unread count header',
  })
  @ApiHeader({
    name: 'X-Unread-Count',
    description: 'Total unread notifications for the user',
    schema: { type: 'integer', example: 2 },
  })
  @ApiOkResponse({ type: NotificationsListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
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
  @ApiOkResponse({ type: UnreadCountResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async unreadCount(@Req() req: RequestWithUser): Promise<{ count: number }> {
    const userId = req.user!.id;
    const count = await this.notifications.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read (ownership enforced)' })
  @ApiOkResponse({ description: 'Notification marked read' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Notification not found' })
  async markRead(@Req() req: RequestWithUser, @Param('id') id: string): Promise<void> {
    const userId = req.user!.id;
    await this.notifications.markRead(userId, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  @ApiOkResponse({ description: 'All notifications marked read' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async markAllRead(@Req() req: RequestWithUser): Promise<void> {
    const userId = req.user!.id;
    await this.notifications.markAllRead(userId);
  }
}

