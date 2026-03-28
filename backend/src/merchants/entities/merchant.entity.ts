import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum MerchantBusinessType {
  RETAIL = 'retail',
  FOOD = 'food',
  SERVICES = 'services',
  TRANSPORT = 'transport',
  OTHER = 'other',
}

export enum MerchantSettlementCurrency {
  NGN = 'NGN',
  USDC = 'USDC',
}

@Entity('merchants')
export class Merchant extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'user_id', unique: true })
  userId!: string;

  @Column({ name: 'business_name', length: 80 })
  businessName!: string;

  @Column({
    name: 'business_type',
    type: 'enum',
    enum: MerchantBusinessType,
  })
  businessType!: MerchantBusinessType;

  @Column({ name: 'logo_key', length: 255, nullable: true, default: null })
  logoKey!: string | null;

  @Column({ length: 300, nullable: true, default: null })
  description!: string | null;

  @Column({ name: 'is_verified', default: false })
  isVerified!: boolean;

  @Column({
    name: 'settlement_currency',
    type: 'enum',
    enum: MerchantSettlementCurrency,
    default: MerchantSettlementCurrency.NGN,
  })
  settlementCurrency!: MerchantSettlementCurrency;

  @Column({ name: 'auto_settle_enabled', default: true })
  autoSettleEnabled!: boolean;

  @Column({
    name: 'settlement_threshold_usdc',
    type: 'numeric',
    precision: 18,
    scale: 6,
    default: 10,
    transformer: {
      to: (value: number | string) => value,
      from: (value: string) => Number(value),
    },
  })
  settlementThresholdUsdc!: number;
}
