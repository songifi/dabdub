import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_LIST } from './queue.constants';
import {
  NotificationQueueProcessor,
  SettlementQueueProcessor,
  StellarMonitorQueueProcessor,
  WebhookQueueProcessor,
} from './queue.processors';
import { QueueAdminController } from './queue-admin.controller';
import { QueueMetricsService } from './queue-metrics.service';
import { StellarModule } from '../stellar/stellar.module';
import { AdminAlertModule } from '../alerts/admin-alert.module';

@Module({
  imports: [
    BullModule.registerQueue(
      ...QUEUE_LIST.map((name) => ({
        name,
        defaultJobOptions: { removeOnFail: false, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      })),
    ),
    forwardRef(() => StellarModule),
    AdminAlertModule,
  ],
  controllers: [QueueAdminController],
  providers: [
    SettlementQueueProcessor,
    WebhookQueueProcessor,
    NotificationQueueProcessor,
    StellarMonitorQueueProcessor,
    QueueMetricsService,
  ],
  exports: [BullModule],
})
export class QueueModule {}
