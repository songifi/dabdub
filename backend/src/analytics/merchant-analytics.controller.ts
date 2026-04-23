import { Controller, Get } from '@nestjs/common';
import {
  MerchantAnalyticsService,
  type MerchantAnalyticsResponse,
} from './merchant-analytics.service';

@Controller('admin/analytics')
export class MerchantAnalyticsController {
  constructor(
    private readonly merchantAnalyticsService: MerchantAnalyticsService,
  ) {}

  @Get('merchants')
  getMerchantAnalytics(): Promise<MerchantAnalyticsResponse> {
    return this.merchantAnalyticsService.getMetrics();
  }
}
