import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookService, WEBHOOKS_QUEUE } from './webhook.service';
import { WebhookProcessor } from './webhook.processor';
import { WebhooksController } from './webhooks.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookSubscription, WebhookDelivery]),
    BullModule.registerQueue({ name: WEBHOOKS_QUEUE }),
    NotificationsModule,
  ],
  providers: [WebhookService, WebhookProcessor],
  controllers: [WebhooksController],
  exports: [WebhookService],
})
export class WebhooksModule {}
