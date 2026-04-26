import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { NotificationService } from './notification.service';

class ListQueryDto {
  limit?: number;
  cursor?: string;
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List in-app notifications with unread count' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  async list(
    @Req() req: Request & { user: { id: string; merchantId?: string } },
    @Query() query: ListQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const merchantId = req.user.merchantId ?? req.user.id;
    const [unread, result] = await Promise.all([
      this.service.getUnreadCount(merchantId),
      this.service.listForUser(merchantId, {
        limit: Number(query.limit ?? 20),
        cursor: query.cursor,
      }),
    ]);
    res.setHeader('X-Unread-Count', String(unread));
    return result;
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async unreadCount(@Req() req: Request & { user: { id: string; merchantId?: string } }) {
    const merchantId = req.user.merchantId ?? req.user.id;
    const count = await this.service.getUnreadCount(merchantId);
    return { count };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(
    @Req() req: Request & { user: { id: string; merchantId?: string } },
    @Param('id') id: string,
  ) {
    const merchantId = req.user.merchantId ?? req.user.id;
    await this.service.markRead(merchantId, id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@Req() req: Request & { user: { id: string; merchantId?: string } }) {
    const merchantId = req.user.merchantId ?? req.user.id;
    await this.service.markAllRead(merchantId);
  }
}
