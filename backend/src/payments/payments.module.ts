import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController, PublicPaymentController } from './payments.controller';
import { Payment } from './entities/payment.entity';
import { StellarModule } from '../stellar/stellar.module';
import { CacheModule } from '../cache/cache.module';
import { IdempotencyInterceptor } from '../payment/idempotency.interceptor';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MerchantsModule } from '../merchants/merchants.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    forwardRef(() => StellarModule),
    CacheModule,
    WebhooksModule,
    NotificationsModule,
    MerchantsModule,
  ],
  controllers: [PaymentsController, PublicPaymentController],
  providers: [PaymentsService, IdempotencyInterceptor],
  exports: [PaymentsService],
})
export class PaymentsModule {}
