import { Module } from '@nestjs/common';
import { MerchantAnalyticsController } from './merchant-analytics.controller';
import { MerchantAnalyticsService } from './merchant-analytics.service';

@Module({
  controllers: [MerchantAnalyticsController],
  providers: [MerchantAnalyticsService],
})
export class MerchantAnalyticsModule {}
