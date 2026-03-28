import { Module } from '@nestjs/common';
import { WsModule } from '../ws/ws.module';
import { QueueAdminNotificationService } from './queue.admin-notification';
import { QueueBoardService } from './queue.board';
import { QueueHealthIndicator } from './queue.health';
import { QueueRegistryService } from './queue.registry';

@Module({
  imports: [WsModule],
  providers: [
    QueueAdminNotificationService,
    QueueRegistryService,
    QueueBoardService,
    QueueHealthIndicator,
  ],
  exports: [QueueBoardService, QueueHealthIndicator, QueueRegistryService],
})
export class QueueModule {}
