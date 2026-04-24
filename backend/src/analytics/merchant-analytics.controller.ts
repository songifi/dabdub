import { Controller, Get, Query } from '@nestjs/common';
import {
  MerchantAnalyticsService,
  type MerchantAnalyticsResponse,
  type TopMerchantsResponse,
  type PaymentFunnelResponse,
} from './merchant-analytics.service';
import { TopMerchantsQueryDto } from './dto/top-merchants-query.dto';
import { PaymentFunnelQueryDto } from './dto/payment-funnel-query.dto';

@Controller('analytics')
export class MerchantAnalyticsController {
  constructor(
    private readonly merchantAnalyticsService: MerchantAnalyticsService,
  ) {}

  @Get('merchants')
  getMerchantAnalytics(): Promise<MerchantAnalyticsResponse> {
    return this.merchantAnalyticsService.getMetrics();
  }

  @Get('top-merchants')
  getTopMerchants(@Query() query: TopMerchantsQueryDto): Promise<TopMerchantsResponse> {
    return this.merchantAnalyticsService.getTopMerchants(query.limit, query.period);
  }

  @Get('funnel')
  getPaymentFunnel(@Query() query: PaymentFunnelQueryDto): Promise<PaymentFunnelResponse> {
    return this.merchantAnalyticsService.getPaymentFunnel(
      query.startDate,
      query.endDate,
      query.network,
    );
  }
}
