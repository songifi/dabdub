import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceSnapshot } from './entities/balance-snapshot.entity';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { SorobanModule } from '../soroban/soroban.module';
import { RatesModule } from '../rates/rates.module';
import { CacheModule } from '../cache/cache.module';
import { BalanceService } from './balance.service';
import { BalanceController } from './balance.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BalanceSnapshot, User, Transaction]),
    SorobanModule,
    RatesModule,
    CacheModule,
  ],
  providers: [BalanceService],
  controllers: [BalanceController],
  exports: [BalanceService],
})
export class BalanceModule {}
