import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum FeeType {
  TRANSFER = 'transfer',
  WITHDRAWAL = 'withdrawal',
  DEPOSIT = 'deposit',
  MERCHANT_SETTLEMENT = 'merchant_settlement',
}

/**
 * FeeConfig stores the base fee schedule for each operation type.
 *
 * Actual fee = baseFeeRate * TierConfig.feeMultiplier, clamped to [minFee, maxFee].
 * All amounts are in the platform's native unit.
 */
@Entity('fee_configs')
export class FeeConfig extends BaseEntity {
  @Column({ name: 'fee_type', type: 'enum', enum: FeeType, unique: true })
  feeType!: FeeType;

  /**
   * Fractional rate applied to the transaction amount.
   * e.g. 0.0100 = 1 %.
   */
  @Column({
    name: 'base_fee_rate',
    type: 'numeric',
    precision: 7,
    scale: 6,
    default: '0.000000',
  })
  baseFeeRate!: string;

  @Column({
    name: 'min_fee',
    type: 'numeric',
    precision: 24,
    scale: 8,
    default: '0',
  })
  minFee!: string;

  /**
   * Null means no upper cap on fees.
   */
  @Column({
    name: 'max_fee',
    type: 'numeric',
    precision: 24,
    scale: 8,
    nullable: true,
    default: null,
  })
  maxFee!: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
