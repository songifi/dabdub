import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAlertModule } from '../alerts/admin-alert.module';
import { StellarService } from './stellar.service';
import { StellarMonitorService } from './stellar-monitor.service';
import { Payment } from '../payments/entities/payment.entity';
import { SettlementsModule } from '../settlements/settlements.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { EmailModule } from '../email/email.module';
import { MerchantsModule } from '../merchants/merchants.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    AdminAlertModule,
    forwardRef(() => SettlementsModule),
    WebhooksModule,
    EmailModule,
    MerchantsModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.stellarMonitor }),
  ],
  providers: [StellarService, StellarMonitorService],
  exports: [StellarService, StellarMonitorService],
})
export class StellarModule {}
