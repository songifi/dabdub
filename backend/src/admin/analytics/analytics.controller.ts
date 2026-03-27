import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import {
  DashboardStatsDto,
  UserGrowthResponseDto,
  VolumeHistoryResponseDto,
  FeeRevenueResponseDto,
  ConversionFunnelDto,
  TierDistributionDto,
} from './dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '../entities/admin.entity';

@ApiTags('admin.analytics')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller({ path: 'admin/analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get cached dashboard stats' })
  @ApiResponse({ status: 200, type: DashboardStatsDto })
  getDashboardStats(): Promise<DashboardStatsDto> {
    return this.analyticsService.getDashboardStats();
  }

  @Get('growth')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get user growth history' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiResponse({ status: 200, type: UserGrowthResponseDto })
  getUserGrowth(@Query('days') days?: number): Promise<UserGrowthResponseDto> {
    return this.analyticsService.getUserGrowth(days);
  }

  @Get('volume')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get transaction volume history' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiResponse({ status: 200, type: VolumeHistoryResponseDto })
  getVolumeHistory(@Query('days') days?: number): Promise<VolumeHistoryResponseDto> {
    return this.analyticsService.getVolumeHistory(days);
  }

  @Get('fees')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get fee revenue history' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiResponse({ status: 200, type: FeeRevenueResponseDto })
  getFeeRevenue(@Query('days') days?: number): Promise<FeeRevenueResponseDto> {
    return this.analyticsService.getFeeRevenue(days);
  }

  @Get('funnel')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get conversion funnel' })
  @ApiResponse({ status: 200, type: ConversionFunnelDto })
  getConversionFunnel(): Promise<ConversionFunnelDto> {
    return this.analyticsService.getConversionFunnel();
  }

  @Get('tiers')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get tier distribution' })
  @ApiResponse({ status: 200, type: TierDistributionDto })
  getTierDistribution(): Promise<TierDistributionDto> {
    return this.analyticsService.getTierDistribution();
  }
}

