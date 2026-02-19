import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

/** Period presets: 7d, 30d, 90d */
export type RevenuePeriod = '7d' | '30d' | '90d';

export const REVENUE_PERIOD_PATTERN = /^([1-9]\d*)d$/;

export enum RevenueGranularity {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class RevenueQueryDto {
  @ApiPropertyOptional({
    description: 'Period preset (e.g. 7d, 30d, 90d)',
    example: '30d',
    default: '30d',
  })
  @IsOptional()
  @IsString()
  @Matches(REVENUE_PERIOD_PATTERN, { message: 'period must be like 7d, 30d, 90d' })
  period?: string = '30d';

  @ApiPropertyOptional({
    description: 'Granularity for trend buckets',
    enum: RevenueGranularity,
    default: RevenueGranularity.DAY,
  })
  @IsOptional()
  @IsEnum(RevenueGranularity)
  granularity?: RevenueGranularity = RevenueGranularity.DAY;
}

export class VsLastPeriodDto {
  @ApiProperty({ example: '+12.3%', description: 'Change vs previous equal-length period' })
  totalRevenueUsd: string;
}

export class RevenueSummaryDto {
  @ApiProperty({ example: '45230.00' })
  totalRevenueUsd: string;
  @ApiProperty({ example: '38000.00' })
  transactionFeeRevenueUsd: string;
  @ApiProperty({ example: '7230.00' })
  settlementFeeRevenueUsd: string;
  @ApiProperty({ example: 12840 })
  transactionCount: number;
  @ApiProperty({ example: '3.52' })
  averageFeePerTransactionUsd: string;
  @ApiProperty({ type: VsLastPeriodDto })
  vsLastPeriod: VsLastPeriodDto;
}

export class FeeTypeBreakdownDto {
  @ApiProperty({ example: '38000.00' })
  revenueUsd: string;
  @ApiProperty({ example: '84.0' })
  percentage: string;
}

export class ByFeeTypeDto {
  transactionFee: FeeTypeBreakdownDto;
  settlementFee: FeeTypeBreakdownDto;
}

export class ByTierItemDto {
  @ApiProperty({ example: '8500.00' })
  revenueUsd: string;
  @ApiProperty({ example: 5200 })
  transactionCount: number;
}

export class ByChainItemDto {
  @ApiProperty({ example: 'base' })
  chain: string;
  @ApiProperty({ example: '28000.00' })
  revenueUsd: string;
  @ApiProperty({ example: '61.9' })
  percentage: string;
}

export class TrendItemDto {
  @ApiProperty({ example: '2026-01-20' })
  period: string;
  @ApiProperty({ example: '1510.00' })
  revenueUsd: string;
  @ApiProperty({ example: 428 })
  transactionCount: number;
}

export class RevenueOverviewResponseDto {
  @ApiProperty({ example: '30d' })
  period: string;
  @ApiProperty({ type: RevenueSummaryDto })
  summary: RevenueSummaryDto;
  @ApiProperty({ type: ByFeeTypeDto })
  byFeeType: ByFeeTypeDto;
  @ApiProperty({ description: 'Revenue by merchant tier', example: { STARTER: { revenueUsd: '8500.00', transactionCount: 5200 } } })
  byTier: Record<string, ByTierItemDto>;
  @ApiProperty({ type: [ByChainItemDto] })
  byChain: ByChainItemDto[];
  @ApiProperty({ type: [TrendItemDto] })
  trend: TrendItemDto[];
}

export class RevenueExportQueryDto {
  @ApiPropertyOptional({ description: 'Period preset (e.g. 7d, 30d)', example: '30d' })
  @IsOptional()
  @IsString()
  @Matches(REVENUE_PERIOD_PATTERN)
  period?: string = '30d';
}

export class RevenueExportResponseDto {
  @ApiProperty({ description: 'Export job ID' })
  jobId: string;
  @ApiProperty({ example: 12840, description: 'Estimated row count' })
  estimatedRows: number;
  @ApiProperty({ example: 'Export queued. You will receive an email when it is ready.' })
  message: string;
}
