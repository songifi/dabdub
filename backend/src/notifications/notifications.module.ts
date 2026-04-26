import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { EmailProcessor } from './email.processor';
import { EmailDeliveryLog } from './entities/email-delivery-log.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { InAppNotification } from './entities/in-app-notification.entity';
import { QueueConfigService } from '../config/queue-config.service';
import { EMAIL_DELIVERY_QUEUE } from '../queue/queue.constants';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([EmailDeliveryLog, NotificationPreference, InAppNotification]),
    BullModule.registerQueue({ name: EMAIL_DELIVERY_QUEUE }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationService, EmailProcessor, QueueConfigService],
  exports: [NotificationsService, NotificationService],
})
export class NotificationsModule {}
