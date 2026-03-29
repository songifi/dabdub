import { ApiProperty } from '@nestjs/swagger';
import { TierName } from '../entities/tier-config.entity';

export class TierLimitPairDto {
  @ApiProperty({ example: '1000.00000000' })
  current!: string;

  @ApiProperty({ example: '5000.00000000' })
  target!: string;
}

export class TierFeeDiscountPairDto {
  @ApiProperty({ example: 0 })
  current!: number;

  @ApiProperty({ example: 20 })
  target!: number;
}

export class TierVirtualCardPairDto {
  @ApiProperty({ example: false })
  current!: boolean;

  @ApiProperty({ example: true })
  target!: boolean;
}

/** Side-by-side comparison of current vs target tier limits and perks. */
export class TierBenefitsDto {
  @ApiProperty({ type: TierLimitPairDto })
  dailyTransferLimitUsdc!: TierLimitPairDto;

  @ApiProperty({ type: TierLimitPairDto })
  monthlyTransferLimitUsdc!: TierLimitPairDto;

  @ApiProperty({ type: TierFeeDiscountPairDto })
  feeDiscountPercent!: TierFeeDiscountPairDto;

  @ApiProperty({ type: TierLimitPairDto })
  yieldApyPercent!: TierLimitPairDto;

  @ApiProperty({ type: TierLimitPairDto })
  minStakeAmountUsdc!: TierLimitPairDto;

  /** Virtual card access is available from Gold upward. */
  @ApiProperty({ type: TierVirtualCardPairDto })
  virtualCardAccess!: TierVirtualCardPairDto;
}

export class TierUpgradeRequirementsDto {
  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty()
  phoneVerified!: boolean;

  @ApiProperty({
    description: 'Whether KYC must be completed to reach the target tier',
  })
  kycRequired!: boolean;

  @ApiProperty({ example: 'none' })
  kycStatus!: string;

  @ApiProperty({ enum: TierName })
  currentTier!: TierName;

  @ApiProperty({ enum: TierName })
  targetTier!: TierName;

  @ApiProperty({ type: TierBenefitsDto })
  benefits!: TierBenefitsDto;
}

export class TierBenefitsRowDto {
  @ApiProperty({ enum: TierName })
  tier!: TierName;

  @ApiProperty()
  dailyTransferLimitUsdc!: string;

  @ApiProperty()
  monthlyTransferLimitUsdc!: string;

  @ApiProperty()
  feeDiscountPercent!: number;

  @ApiProperty()
  yieldApyPercent!: string;

  @ApiProperty()
  minStakeAmountUsdc!: string;

  @ApiProperty()
  virtualCardAccess!: boolean;
}

export class TierBenefitsTableDto {
  @ApiProperty({ type: [TierBenefitsRowDto] })
  tiers!: TierBenefitsRowDto[];
}
