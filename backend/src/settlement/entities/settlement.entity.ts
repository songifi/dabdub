import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Merchant } from '../../database/entities/merchant.entity';
import { PaymentRequest } from '../../database/entities/payment-request.entity';
import { SettlementRule } from '../../database/entities/settlement-rule.entity';

export enum SettlementStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum SettlementProvider {
  STRIPE = 'stripe',
  BANK_API = 'bank_api',
  WISE = 'wise',
  PAYPAL = 'paypal',
  OTHER = 'other',
}

@Entity('settlements')
@Index(['status'])
@Index(['merchantId'])
@Index(['settledAt'])
@Index(['paymentRequestId'], { unique: true })
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'payment_request_id', type: 'uuid', unique: true })
  paymentRequestId!: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string;

  @Column({ type: 'decimal', precision: 19, scale: 4 })
  amount!: number;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({
    type: 'enum',
    enum: SettlementStatus,
    default: SettlementStatus.PENDING,
  })
  status!: SettlementStatus;

  // Bank transfer details
  @Column({
    name: 'bank_account_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  bankAccountNumber!: string;

  @Column({
    name: 'bank_routing_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  bankRoutingNumber!: string;

  @Column({ name: 'bank_name', type: 'varchar', length: 255, nullable: true })
  bankName!: string;

  @Column({
    name: 'bank_account_holder_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  bankAccountHolderName!: string;

  @Column({
    name: 'bank_swift_code',
    type: 'varchar',
    length: 11,
    nullable: true,
  })
  bankSwiftCode!: string;

  @Column({ name: 'bank_iban', type: 'varchar', length: 34, nullable: true })
  bankIban!: string;

  // Settlement batch support
  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId!: string;

  @Column({ name: 'batch_sequence', type: 'int', nullable: true })
  batchSequence!: number;

  // Fee calculation and tracking
  @Column({
    name: 'fee_amount',
    type: 'decimal',
    precision: 19,
    scale: 4,
    default: 0,
  })
  feeAmount!: number;

  @Column({
    name: 'fee_percentage',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  feePercentage!: number;

  @Column({ name: 'net_amount', type: 'decimal', precision: 19, scale: 4 })
  netAmount!: number;

  // Exchange rate at settlement time
  @Column({
    name: 'exchange_rate',
    type: 'decimal',
    precision: 19,
    scale: 8,
    nullable: true,
  })
  exchangeRate!: number;

  @Column({
    name: 'source_currency',
    type: 'varchar',
    length: 3,
    nullable: true,
  })
  sourceCurrency!: string;

  // Settlement provider
  @Column({
    type: 'enum',
    enum: SettlementProvider,
    nullable: true,
  })
  provider!: SettlementProvider;

  @Column({
    name: 'provider_reference',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerReference!: string;

  // Settlement receipt/reference number
  @Column({
    name: 'settlement_receipt',
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  settlementReceipt!: string;

  @Column({
    name: 'settlement_reference',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  settlementReference!: string;

  // Failure reason and retry count
  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  @Column({ name: 'max_retries', type: 'int', default: 3 })
  maxRetries!: number;

  // Timestamps
  @Column({ name: 'settled_at', type: 'timestamp', nullable: true })
  settledAt!: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Settlement metadata JSON field
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any>;

  // Relationships
  @OneToOne(() => PaymentRequest, (paymentRequest) => paymentRequest.settlement)
  @JoinColumn({ name: 'payment_request_id' })
  paymentRequest!: PaymentRequest;

  @Column({ name: 'applied_rule_id', type: 'uuid', nullable: true })
  appliedRuleId?: string;

  @ManyToOne(() => SettlementRule, { nullable: true })
  @JoinColumn({ name: 'applied_rule_id' })
  appliedRule?: SettlementRule;

  @ManyToOne(() => Merchant, (merchant) => merchant.settlements)
  @JoinColumn({ name: 'merchant_id' })
  merchant!: Merchant;
}
