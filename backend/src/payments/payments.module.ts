import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController, PublicPaymentController } from './payments.controller';
import { Payment } from './entities/payment.entity';
import { StellarModule } from '../stellar/stellar.module';
import { CacheModule } from '../cache/cache.module';
import { IdempotencyInterceptor } from '../payment/idempotency.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), forwardRef(() => StellarModule), CacheModule],
  controllers: [PaymentsController, PublicPaymentController],
  providers: [PaymentsService, IdempotencyInterceptor],
  exports: [PaymentsService],
})
export class PaymentsModule {}
