import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { Payment } from '../database/entities/payment.entity';
import { PaymentRequest } from '../database/entities/payment-request.entity';
import { PlatformWallet } from '../treasury/entities/platform-wallet.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentMetrics } from './payment.metrics';
import { ExchangeRateModule } from '../exchange-rate/exchange-rate.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentRequest, PlatformWallet]),
    ExchangeRateModule,
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentMetrics,
    makeCounterProvider({
      name: 'payment_processed_total',
      help: 'Total number of processed payments',
      labelNames: ['currency'],
    }),
    makeCounterProvider({
      name: 'payment_failed_total',
      help: 'Total number of failed payments',
      labelNames: ['currency', 'reason'],
    }),
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
