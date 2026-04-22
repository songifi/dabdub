import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum TierName {
  SILVER = 'Silver',
  GOLD = 'Gold',
  BLACK = 'Black',
}

@Entity('tier_configs')
export class TierConfig extends BaseEntity {
  @Column({ type: 'enum', enum: TierName, unique: true })
  tier!: TierName;

  @Column({
    name: 'daily_transfer_limit_usdc',
    type: 'numeric',
    precision: 24,
    scale: 8,
    default: '0',
  })
  dailyTransferLimitUsdc!: string;

  @Column({
    name: 'monthly_transfer_limit_usdc',
    type: 'numeric',
    precision: 24,
    scale: 8,
    default: '0',
  })
  monthlyTransferLimitUsdc!: string;

  @Column({
    name: 'max_single_withdrawal_usdc',
    type: 'numeric',
    precision: 24,
    scale: 8,
    default: '0',
  })
  maxSingleWithdrawalUsdc!: string;

  /**
   * Fee discount in percent (0–100).
   * Silver = 0, Gold = 20, Black = 50.
   */
  @Column({
    name: 'fee_discount_percent',
    type: 'int',
    default: 0,
  })
  feeDiscountPercent!: number;

  @Column({
    name: 'yield_apy_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: '0.00',
  })
  yieldApyPercent!: string;

  @Column({
    name: 'min_stake_amount_usdc',
    type: 'numeric',
    precision: 24,
    scale: 8,
    default: '0',
  })
  minStakeAmountUsdc!: string;

  @Column({
    name: 'stake_lockup_days',
    type: 'int',
    default: 0,
  })
  stakeLockupDays!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
