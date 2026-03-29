import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum FeeType {
  TRANSFER = 'transfer',
  WITHDRAWAL = 'withdrawal',
  PAYLINK = 'paylink',
  STAKE = 'stake',
  DEPOSIT = 'deposit',
}

export enum FeeRateType {
  PERCENT = 'percent',
  FLAT = 'flat',
}

/**
 * FeeConfig stores active admin-configurable fee schedules.
 */
@Entity('fee_configs')
export class FeeConfig extends BaseEntity {
  @Column({ name: 'fee_type', type: 'enum', enum: FeeType })
  feeType!: FeeType;

  @Column({ name: 'rate_type', type: 'enum', enum: FeeRateType })
  rateType!: FeeRateType;

  @Column({
    name: 'fee_value',
    type: 'numeric',
    precision: 24,
    scale: 8,
  })
  value!: string;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom!: Date;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', nullable: true })
  createdBy!: string | null;

  get type(): FeeType {
    return this.feeType;
  }

  set type(value: FeeType) {
    this.feeType = value;
  }
}
