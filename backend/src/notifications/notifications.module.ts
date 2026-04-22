import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WsModule } from '../ws/ws.module';
import { Notification } from './entities/notification.entity';
import { NotificationService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), WsModule],
  providers: [NotificationService],
  controllers: [NotificationsController],
  exports: [NotificationService],
})
export class NotificationsModule {}

