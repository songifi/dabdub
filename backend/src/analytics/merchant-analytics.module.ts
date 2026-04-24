import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantAnalyticsController } from './merchant-analytics.controller';
import { MerchantAnalyticsService } from './merchant-analytics.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule, TypeOrmModule],
  controllers: [MerchantAnalyticsController],
  providers: [MerchantAnalyticsService],
})
export class MerchantAnalyticsModule {}
