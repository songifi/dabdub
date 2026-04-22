import { ApiProperty } from '@nestjs/swagger';
import { TierName } from '../entities/tier-config.entity';

export class TierConfigResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: TierName })
  tier!: TierName;

  @ApiProperty({ example: '10000.00000000' })
  dailyTransferLimitUsdc!: string;

  @ApiProperty({ example: '50000.00000000' })
  monthlyTransferLimitUsdc!: string;

  @ApiProperty({ example: '5000.00000000' })
  maxSingleWithdrawalUsdc!: string;

  @ApiProperty({ example: 20, description: 'Fee discount percent (0–100)' })
  feeDiscountPercent!: number;

  @ApiProperty({ example: '4.50' })
  yieldApyPercent!: string;

  @ApiProperty({ example: '100.00000000' })
  minStakeAmountUsdc!: string;

  @ApiProperty({ example: 30 })
  stakeLockupDays!: number;

  @ApiProperty()
  isActive!: boolean;
}
