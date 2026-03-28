import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deposit } from './entities/deposit.entity';
import { DepositsService } from './deposits.service';
import { TransactionsModule } from '../transactions/transactions.module';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [TypeOrmModule.forFeature([Deposit]), TransactionsModule, BalanceModule],
  providers: [DepositsService],
  exports: [DepositsService],
})
export class DepositsModule {}
