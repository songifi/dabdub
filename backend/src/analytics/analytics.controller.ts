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
  async getVolume(@Request() req, @Query('period') period: 'daily' | 'monthly' = 'daily') {
    return this.analyticsService.getVolume(req.user.merchantId, period);
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Get payment funnel metrics' })
  async getFunnel(@Request() req) {
    return this.analyticsService.getFunnel(req.user.merchantId);
  }

  @Get('comparison')
  @ApiOperation({ summary: 'Compare current period with previous' })
  @ApiQuery({ name: 'period', enum: ['daily', 'monthly'], required: false })
  async getComparison(@Request() req, @Query('period') period: 'daily' | 'monthly' = 'daily') {
    return this.analyticsService.getComparison(req.user.merchantId, period);
  }
}
