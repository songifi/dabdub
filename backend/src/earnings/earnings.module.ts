import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YieldEntry } from './entities/yield-entry.entity';
import { User } from '../users/entities/user.entity';
import { TierConfig } from '../tier-config/entities/tier-config.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { CacheModule } from '../cache/cache.module';
import { TierConfigModule } from '../tier-config/tier-config.module';
import { EarningsService } from './earnings.service';
import { EarningsController } from './earnings.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([YieldEntry, User, TierConfig, Transaction]),
    CacheModule,
    TierConfigModule,
  ],
  providers: [EarningsService],
  controllers: [EarningsController],
  exports: [EarningsService],
})
export class EarningsModule {}
