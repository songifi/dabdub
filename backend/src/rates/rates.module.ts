import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '../cache/cache.module';
import { RateSnapshot } from './entities/rate-snapshot.entity';
import { RatesService } from './rates.service';

@Module({
  imports: [TypeOrmModule.forFeature([RateSnapshot]), CacheModule],
  providers: [RatesService],
  exports: [RatesService],
})
export class RatesModule {}
