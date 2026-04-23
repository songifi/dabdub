import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

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
