import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Delete,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { RedeliverWebhookDto } from './dto/redeliver-webhook.dto';
import type { WebhookEvent } from './webhooks.events';

interface RequestWithUser {
  user?: { id: string };
}

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhookService) {}

  @Post()
  @ApiOperation({ summary: 'Create webhook subscription; returns secret once' })
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateWebhookDto,
  ): Promise<{
    id: string;
    url: string;
    events: string[];
    isActive: boolean;
    secret: string;
  }> {
    const userId = req.user!.id;
    const { subscription, secretOnce } = await this.webhooks.createSubscription(
      userId,
      dto.url,
      dto.events as WebhookEvent[],
    );
    return {
      id: subscription.id,
      url: subscription.url,
      events: subscription.events,
      isActive: subscription.isActive,
      secret: secretOnce,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List webhook subscriptions' })
  async list(
    @Req() req: RequestWithUser,
  ): Promise<
    Array<{ id: string; url: string; events: string[]; isActive: boolean }>
  > {
    const userId = req.user!.id;
    const subs = await this.webhooks.listSubscriptions(userId);
    return subs.map((s) => ({
      id: s.id,
      url: s.url,
      events: s.events,
      isActive: s.isActive,
    }));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a webhook subscription' })
  async remove(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<void> {
    const userId = req.user!.id;
    await this.webhooks.deactivateSubscription(userId, id);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'List deliveries for a subscription' })
  async deliveries(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<any[]> {
    const userId = req.user!.id;
    const items = await this.webhooks.listDeliveries(userId, id);
    return items;
  }

  @Post(':id/redeliver')
  @ApiOperation({ summary: 'Re-enqueue a delivery (optionally by deliveryId)' })
  async redeliver(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: RedeliverWebhookDto,
  ): Promise<{ deliveryId: string }> {
    const userId = req.user!.id;
    const delivery = await this.webhooks.redeliver(userId, id, dto.deliveryId);
    return { deliveryId: delivery.id };
  }
}
