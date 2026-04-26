import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '../cache/cache.module';
import { CronModule } from '../cron/cron.module';
import { RateSnapshot } from './entities/rate-snapshot.entity';
import { RatesService } from './rates.service';
import { RatesProcessor } from './rates.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([RateSnapshot]),
    CacheModule,
    BullModule.registerQueue({ name: 'rates' }),
    CronModule,
  ],
  providers: [RatesService, RatesProcessor],
  exports: [RatesService],
})
export class RatesModule {}
