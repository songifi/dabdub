import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { OffRamp } from './entities/off-ramp.entity';
import { OffRampService } from './offramp.service';
import { OffRampController } from './offramp.controller';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';
import { User } from '../users/entities/user.entity';
import { TierConfig } from '../tier-config/entities/tier-config.entity';
import { FeeConfig } from '../fee-config/entities/fee-config.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { RatesModule } from '../rates/rates.module';
import { SorobanModule } from '../soroban/soroban.module';
import { PinModule } from '../pin/pin.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([OffRamp, BankAccount, User, TierConfig, FeeConfig, Transaction]),
    RatesModule,
    SorobanModule,
    PinModule,
  ],
  providers: [OffRampService],
  controllers: [OffRampController],
  exports: [OffRampService],
})
export class OffRampModule {}
