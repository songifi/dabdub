import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Withdrawal } from './entities/withdrawal.entity';
import { FeeConfig } from '../fee-config/entities/fee-config.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { WithdrawalsService, WITHDRAWAL_QUEUE } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalProcessor } from './processors/withdrawal.processor';
import { SorobanModule } from '../soroban/soroban.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Withdrawal, FeeConfig, Transaction]),
    BullModule.registerQueue({ name: WITHDRAWAL_QUEUE }),
    SorobanModule,
    NotificationsModule,
  ],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService, WithdrawalProcessor],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
