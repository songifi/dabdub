import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsProcessor } from './analytics.processor';
import { User } from '../entities/user.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { WaitlistEntry } from '../../waitlist/entities/waitlist-entry.entity';
import { CacheModule } from '../../cache/cache.module';

const ANALYTICS_QUEUE = 'analytics';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Transaction, WaitlistEntry]),
    CacheModule,
    BullModule.registerQueue({
      name: ANALYTICS_QUEUE,
    }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsProcessor],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}


