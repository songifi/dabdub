import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Withdrawal } from './entities/withdrawal.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { WithdrawalsService, WITHDRAWAL_QUEUE } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalProcessor } from './processors/withdrawal.processor';
import { SorobanModule } from '../soroban/soroban.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BalanceModule } from '../balance/balance.module';
import { COMPLIANCE_QUEUE } from '../compliance/compliance.service';
import { FeesModule } from '../fees/fees.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Withdrawal, Transaction]),
    BullModule.registerQueue({ name: WITHDRAWAL_QUEUE }),
    BullModule.registerQueue({ name: COMPLIANCE_QUEUE }),
    SorobanModule,
    NotificationsModule,
    BalanceModule,
    FeesModule,
  ],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService, WithdrawalProcessor],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
