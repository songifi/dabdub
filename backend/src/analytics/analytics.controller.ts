import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { MerchantRole } from '../merchants/entities/merchant.entity';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Get settlement fee revenue analytics' })
  @ApiQuery({ name: 'period', enum: ['daily', 'monthly'], required: false })
  @ApiQuery({ name: 'from', required: false, description: 'Start date in YYYY-MM-DD format' })
  @ApiQuery({ name: 'to', required: false, description: 'End date in YYYY-MM-DD format' })
  async getRevenue(
    @Request() req: { user: { merchantId: string; role: MerchantRole } },
    @Query('period') period: 'daily' | 'monthly' = 'daily',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const isAdmin =
      req.user.role === MerchantRole.ADMIN || req.user.role === MerchantRole.SUPERADMIN;

    return this.analyticsService.getRevenue({
      scope: isAdmin ? 'admin' : 'merchant',
      merchantId: isAdmin ? undefined : req.user.merchantId,
      period,
      from,
      to,
    });
  }

  @Get('volume')
  @ApiOperation({ summary: 'Get payment volume aggregation' })
  @ApiQuery({ name: 'period', enum: ['daily', 'monthly'], required: false })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date in YYYY-MM-DD format' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'End date in YYYY-MM-DD format' })
  async getVolume(
    @Request() req: { user: { merchantId: string; role: MerchantRole } },
    @Query('period') period: 'daily' | 'monthly' = 'daily',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const isAdmin =
      req.user.role === MerchantRole.ADMIN || req.user.role === MerchantRole.SUPERADMIN;

    return this.analyticsService.getVolume({
      scope: isAdmin ? 'admin' : 'merchant',
      merchantId: isAdmin ? undefined : req.user.merchantId,
      period,
      dateFrom,
      dateTo,
    });
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Get payment funnel metrics' })
  @ApiQuery({ name: 'compareWith', enum: ['previous'], required: false })
  async getFunnel(@Request() req, @Query('compareWith') compareWith?: 'previous') {
    return this.analyticsService.getFunnel(req.user.merchantId, compareWith);
  }

  @Get('comparison')
  @ApiOperation({ summary: 'Compare current period with previous' })
  @ApiQuery({ name: 'period', enum: ['daily', 'monthly'], required: false })
  async getComparison(@Request() req, @Query('period') period: 'daily' | 'monthly' = 'daily') {
    return this.analyticsService.getComparison(req.user.merchantId, period);
  }

  @Get('networks')
  @ApiOperation({ summary: 'Get payment volume breakdown by blockchain network' })
  @ApiQuery({ name: 'sortBy', enum: ['volume', 'count'], required: false })
  @ApiQuery({ name: 'period', enum: ['daily', 'monthly'], required: false })
  async getNetworkBreakdown(
    @Request() req,
    @Query('sortBy') sortBy: 'volume' | 'count' = 'volume',
    @Query('period') period: 'daily' | 'monthly' = 'daily',
  ) {
    return this.analyticsService.getNetworkBreakdown(req.user.merchantId, sortBy, period);
  }
}
