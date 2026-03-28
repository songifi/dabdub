import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class DashboardStatsDto {
  @ApiProperty({ example: 1250 })
  @IsNumber()
  totalUsers!: number;

  @ApiProperty({ example: 45 })
  @IsNumber()
  newUsersToday!: number;

  @ApiProperty({ example: 120 })
  @IsNumber()
  newUsersThisWeek!: number;

  @ApiProperty({ example: 89 })
  @IsNumber()
  dauToday!: number;

  @ApiProperty({ example: '15000.50' })
  @IsString()
  totalTransactionVolumeUsdc!: string;

  @ApiProperty({ example: '1250.75' })
  @IsString()
  transactionVolumeToday!: string;

  @ApiProperty({ example: '2500.25' })
  @IsString()
  totalFeesCollectedUsdc!: string;

  @ApiProperty({ example: '75.50' })
  @IsString()
  feesToday!: string;

  @ApiProperty({ example: 25 })
  @IsNumber()
  totalMerchants!: number;

  @ApiProperty({ example: 8 })
  @IsNumber()
  activeMerchantsToday!: number;

  @ApiProperty({ example: 350 })
  @IsNumber()
  waitlistSize!: number;

  @ApiProperty({ example: 12 })
  @IsNumber()
  waitlistGrowthToday!: number;
}



