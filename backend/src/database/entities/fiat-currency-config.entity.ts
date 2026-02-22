import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum RateSource {
  CHAINLINK = 'CHAINLINK',
  COINGECKO = 'COINGECKO',
  MANUAL = 'MANUAL',
  PARTNER_FEED = 'PARTNER_FEED',
}

export interface SettlementBankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingCode?: string;
  swiftCode?: string;
  bankAddress?: string;
  country?: string;
  [key: string]: any;
}

@Entity('fiat_currency_configs')
export class FiatCurrencyConfig extends BaseEntity {
  @Column({ unique: true })
  @Index({ unique: true })
  currencyCode: string; // ISO 4217: 'USD', 'NGN', 'GBP', 'EUR'

  @Column()
  displayName: string; // 'Nigerian Naira'

  @Column()
  symbol: string; // '₦'

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  minimumSettlementAmount: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  maximumSettlementAmount: string | null;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  minimumTransactionAmount: string;

  @Column({
    type: 'enum',
    enum: RateSource,
  })
  rateSource: RateSource;

  @Column({ nullable: true })
  rateSourceConfig: string | null; // JSON config for the rate source

  @Column({ type: 'jsonb', default: [] })
  supportedLiquidityProviders: string[];

  @Column({ type: 'jsonb', nullable: true })
  settlementBankDetails: SettlementBankDetails | null;

  @Column({ type: 'int', default: 24 })
  defaultSettlementDelayHours: number;

  @Column({ type: 'jsonb', default: {} })
  operatingHours: Record<string, string>; // { monday: '09:00-17:00', ... }
}
