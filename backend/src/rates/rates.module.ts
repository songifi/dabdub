import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '../cache/cache.module';
import { CronModule } from '../cron/cron.module';
import { StellarModule } from '../stellar/stellar.module';
import { RateSnapshot } from './entities/rate-snapshot.entity';
import { RatesService } from './rates.service';
import { RatesProcessor } from './rates.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([RateSnapshot]),
    CacheModule,
    StellarModule,
    BullModule.registerQueue({ name: 'rates' }),
    CronModule,
  ],
  providers: [RatesService, RatesProcessor],
  exports: [RatesService],
})
export class RatesModule {}
