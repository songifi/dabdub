import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Deposit } from './entities/deposit.entity';
import { DepositsService } from './deposits.service';
import { TransactionsModule } from '../transactions/transactions.module';
import { BalanceModule } from '../balance/balance.module';
import { COMPLIANCE_QUEUE } from '../compliance/compliance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deposit]),
    BullModule.registerQueue({ name: COMPLIANCE_QUEUE }),
    TransactionsModule,
    BalanceModule,
  ],
  providers: [DepositsService],
  exports: [DepositsService],
})
export class DepositsModule {}
