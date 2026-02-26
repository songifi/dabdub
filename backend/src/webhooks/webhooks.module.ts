import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookConfigurationEntity } from '../database/entities/webhook-configuration.entity';
import { WebhookDeliveryLogEntity } from '../database/entities/webhook-delivery-log.entity';
import { WebhookDeliveryService } from '../webhook/services/webhook-delivery.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebhookConfigurationEntity,
      WebhookDeliveryLogEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDeliveryService],
  exports: [WebhooksService, WebhookDeliveryService],
})
export class WebhooksModule {}
