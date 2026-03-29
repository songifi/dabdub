import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { BulkPayment } from './entities/bulk-payment.entity';
import { BulkPaymentRow } from './entities/bulk-payment-row.entity';
import { BulkPaymentService, BULK_PAYMENT_QUEUE } from './bulk-payment.service';
import { BulkPaymentProcessor } from './bulk-payment.processor';
import { BulkPaymentController } from './bulk-payment.controller';
import { R2Module } from '../r2/r2.module';
import { UsersModule } from '../users/users.module';
import { BalanceModule } from '../balance/balance.module';
import { PinModule } from '../pin/pin.module';
import { TierConfigModule } from '../tier-config/tier-config.module';
import { TransfersModule } from '../transfers/transfers.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BulkPayment, BulkPaymentRow]),
    BullModule.registerQueue({
      name: BULK_PAYMENT_QUEUE,
    }),
    R2Module,
    UsersModule,
    BalanceModule,
    PinModule,
    TierConfigModule,
    TransfersModule,
    EmailModule,
  ],
  controllers: [BulkPaymentController],
  providers: [BulkPaymentService, BulkPaymentProcessor],
  exports: [BulkPaymentService],
})
export class BulkPaymentModule {}