import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RequirePermissionGuard } from '../auth/guards/require-permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';
import type { DashboardOverviewResponseDto } from './dto/dashboard-overview-response.dto';

@ApiTags('Dashboard')
@Controller('api/v1/dashboard')
@UseGuards(JwtGuard, RequirePermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @RequirePermission('analytics:read')
  @ApiOperation({
    summary: 'Dashboard overview',
    description:
      'Returns platform overview metrics for the given period. Cached per period (60s TTL). Response may include X-Cache-Stale: true when serving stale data during refresh.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard overview',
  })
  async getOverview(
    @Query() query: DashboardOverviewQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DashboardOverviewResponseDto> {
    const period = query.period ?? '24h';
    return this.dashboardService.getOverview(period, res);
  }
}
