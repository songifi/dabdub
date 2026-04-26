import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { WebhooksService } from "./webhooks.service";
import { WebhooksController } from "./webhooks.controller";
import { Webhook } from "./entities/webhook.entity";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { WebhookDeliveryProcessor } from "./webhook-delivery.processor";
import { QueueModule } from "../queue/queue.module";
import { WebhookDeliveryLog } from "./entities/webhook-delivery-log.entity";
import { WEBHOOK_DELIVERY_QUEUE } from "../queue/queue.constants";

@Module({
  imports: [
    QueueModule,
    TypeOrmModule.forFeature([Webhook, WebhookDeliveryLog]),
    BullModule.registerQueue({ name: WEBHOOK_DELIVERY_QUEUE }),
  ],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    WebhookDeliveryService,
    WebhookDeliveryProcessor,
  ],
  exports: [WebhooksService],
})
export class WebhooksModule {}
