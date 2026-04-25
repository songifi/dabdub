import { Module } from '@nestjs/common';
import { MerchantAnalyticsController } from './merchant-analytics.controller';
import { MerchantAnalyticsService } from './merchant-analytics.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  controllers: [MerchantAnalyticsController],
  providers: [MerchantAnalyticsService],
})
export class MerchantAnalyticsModule {}
