import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { EmailProcessor } from './email.processor';
import { EmailDeliveryLog } from './entities/email-delivery-log.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { QueueConfigService } from '../config/queue-config.service';
import { EMAIL_DELIVERY_QUEUE } from '../queue/queue.constants';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([EmailDeliveryLog, NotificationPreference]),
    BullModule.registerQueue({ name: EMAIL_DELIVERY_QUEUE }),
  ],
  providers: [NotificationsService, EmailProcessor, QueueConfigService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
