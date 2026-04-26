import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { AdminAlertModule } from '../alerts/admin-alert.module';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { Webhook } from './entities/webhook.entity';
import { WebhookDeliveryLog } from './entities/webhook-delivery-log.entity';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookFailureAlertService } from './webhook-failure-alert.service';
import { QueueConfigService } from '../config/queue-config.service';
import { WEBHOOK_DELIVERY_QUEUE } from '../queue/queue.constants';
import { Merchant } from '../merchants/entities/merchant.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Webhook, WebhookDeliveryLog, Merchant]),
    BullModule.registerQueue({ name: WEBHOOK_DELIVERY_QUEUE }),
    AdminAlertModule,
    NotificationsModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDeliveryProcessor, WebhookDeliveryService, WebhookFailureAlertService, QueueConfigService],
  exports: [WebhooksService, WebhookDeliveryService],
})
export class WebhooksModule {}
