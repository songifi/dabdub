import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { OffRamp } from './entities/off-ramp.entity';
import { OffRampService } from './offramp.service';
import { OffRampController } from './offramp.controller';
import { OffRampWebhookController } from './offramp-webhook.controller';
import { OffRampProcessor } from './offramp.processor';
import { OffRampScheduler } from './offramp.scheduler';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';
import { User } from '../users/entities/user.entity';
import { TierConfig } from '../tier-config/entities/tier-config.entity';
import { FeeConfig } from '../fee-config/entities/fee-config.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { RatesModule } from '../rates/rates.module';
import { SorobanModule } from '../soroban/soroban.module';
import { PinModule } from '../pin/pin.module';
import { FlutterwaveModule } from '../flutterwave/flutterwave.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([OffRamp, BankAccount, User, TierConfig, FeeConfig, Transaction]),
    BullModule.registerQueue({ name: 'offramp-jobs' }),
    RatesModule,
    SorobanModule,
    PinModule,
    FlutterwaveModule,
  ],
  providers: [OffRampService, OffRampProcessor, OffRampScheduler],
  controllers: [OffRampController, OffRampWebhookController],
  exports: [OffRampService],
})
export class OffRampModule {}
