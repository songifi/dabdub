import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const DASHBOARD_PERIODS = ['24h', '7d', '30d', '90d'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export class DashboardOverviewQueryDto {
  @ApiPropertyOptional({
    description: 'Time period for dashboard metrics',
    enum: DASHBOARD_PERIODS,
    default: '24h',
  })
  @IsOptional()
  @IsIn(DASHBOARD_PERIODS)
  period?: DashboardPeriod = '24h';
}
