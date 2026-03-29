import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum OffRampStatus {
  PENDING = 'pending',
  USDC_DEDUCTED = 'usdc_deducted',
  TRANSFER_INITIATED = 'transfer_initiated',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum OffRampProvider {
  PAYSTACK = 'paystack',
  FLUTTERWAVE = 'flutterwave',
}

@Entity('off_ramps')
@Index(['userId', 'createdAt'])
@Index(['reference'], { unique: true })
export class OffRamp extends BaseEntity {
  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'amount_usdc', type: 'numeric', precision: 24, scale: 8 })
  amountUsdc!: string;

  @Column({ name: 'fee_usdc', type: 'numeric', precision: 24, scale: 8 })
  feeUsdc!: string;

  @Column({ name: 'net_amount_usdc', type: 'numeric', precision: 24, scale: 8 })
  netAmountUsdc!: string;

  @Column({ name: 'rate', type: 'numeric', precision: 18, scale: 6 })
  rate!: string;

  @Column({ name: 'spread_percent', type: 'numeric', precision: 5, scale: 2 })
  spreadPercent!: string;

  @Column({ name: 'ngn_amount', type: 'numeric', precision: 24, scale: 2 })
  ngnAmount!: string;

  @Column({ name: 'bank_account_id' })
  bankAccountId!: string;

  @Column({ name: 'bank_account_number', length: 20 })
  bankAccountNumber!: string;

  @Column({ name: 'bank_name', length: 120 })
  bankName!: string;

  @Column({ name: 'account_name', length: 160 })
  accountName!: string;

  @Column({ name: 'reference', length: 100, unique: true })
  reference!: string;

  @Column({ name: 'provider_reference', length: 100, nullable: true })
  providerReference!: string | null;

  @Column({ name: 'provider', type: 'enum', enum: OffRampProvider, default: OffRampProvider.PAYSTACK })
  provider!: OffRampProvider;

  @Column({ name: 'status', type: 'enum', enum: OffRampStatus, default: OffRampStatus.PENDING })
  status!: OffRampStatus;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ name: 'transaction_id', nullable: true })
  transactionId!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;
}
