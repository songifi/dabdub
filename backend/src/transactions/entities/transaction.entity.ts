import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { TransactionStatus, TransactionType } from '../transactions.enums';
import { PaymentRequest } from '../../database/entities/payment-request.entity';
import { TransactionStatusHistory } from './transaction-status-history.entity';

@Entity('transactions')
@Index(['txHash'])
@Index(['network'])
@Index(['status'])
@Index(['network', 'status'])
@Index(['paymentRequestId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['network', 'tokenSymbol'])
@Index(['flaggedForReview'])
@Index(['isSandbox'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'is_sandbox', type: 'boolean', default: false })
  isSandbox!: boolean;

  // --- RELATIONSHIP TO PAYMENT REQUEST ---
  @Column({ name: 'payment_request_id' })
  paymentRequestId!: string;

  @ManyToOne(() => PaymentRequest, (pr) => pr.transactions)
  @JoinColumn({ name: 'payment_request_id' })
  paymentRequest!: PaymentRequest;

  // --- BLOCKCHAIN DATA ---
  @Column({ name: 'tx_hash', type: 'varchar', unique: true })
  txHash!: string;

  @Column({ type: 'varchar', length: 50 })
  network!: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type!: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status!: TransactionStatus;

  // --- ADDRESSES ---
  @Column({ name: 'from_address', type: 'varchar' })
  fromAddress!: string;

  @Column({ name: 'to_address', type: 'varchar' })
  toAddress!: string;

  // --- AMOUNT TRACKING ---
  @Column({ name: 'crypto_amount', type: 'decimal', precision: 36, scale: 18 })
  cryptoAmount!: string;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 36,
    scale: 18,
    nullable: true,
  })
  amount?: string;

  @Column({ name: 'currency', type: 'varchar', length: 10, default: 'USD' })
  currency!: string;

  @Column({
    name: 'usd_value',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  usdValue!: number;

  @Column({
    name: 'fiat_amount',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  fiatAmount!: number;

  // --- CONFIRMATIONS ---
  @Column({ name: 'block_number', type: 'bigint', nullable: true })
  blockNumber!: number;

  @Column({ type: 'int', default: 0 })
  confirmations!: number;

  @Column({ name: 'required_confirmations', type: 'int', default: 12 })
  requiredConfirmations!: number;

  // --- GAS & RECEIPTS ---
  @Column({
    name: 'fee_amount',
    type: 'decimal',
    precision: 36,
    scale: 18,
    nullable: true,
  })
  feeAmount!: string;

  @Column({ type: 'jsonb', nullable: true })
  receipt!: Record<string, any>;

  // --- MONITORING & ERROR LOGGING ---
  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string;

  // --- TIMESTAMPS ---
  @Column({ name: 'block_timestamp', type: 'timestamp', nullable: true })
  blockTimestamp!: Date;

  @Column({ name: 'token_address', type: 'varchar', length: 100, nullable: true })
  tokenAddress?: string;

  @Column({ name: 'token_symbol', type: 'varchar', length: 20, nullable: true })
  tokenSymbol?: string;

  @Column({ name: 'gas_used', type: 'varchar', length: 50, nullable: true })
  gasUsed?: string;

  @Column({ name: 'gas_price_gwei', type: 'varchar', length: 50, nullable: true })
  gasPriceGwei?: string;

  @Column({ name: 'network_fee_eth', type: 'varchar', length: 50, nullable: true })
  networkFeeEth?: string;

  @Column({ name: 'network_fee_usd', type: 'decimal', precision: 18, scale: 8, nullable: true })
  networkFeeUsd?: string;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 18, scale: 8, nullable: true })
  exchangeRate?: string;

  @Column({ name: 'valued_at', type: 'timestamp', nullable: true })
  valuedAt?: Date;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string;

  @Column({ name: 'settled_at', type: 'timestamp', nullable: true })
  settledAt?: Date;

  @Column({ name: 'flagged_for_review', type: 'boolean', default: false })
  flaggedForReview!: boolean;

  @Column({ name: 'fee_collected_usd', type: 'decimal', precision: 20, scale: 8, nullable: true })
  feeCollectedUsd?: string;

  @Column({ name: 'settlement_id', type: 'varchar', nullable: true })
  settlementId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
  confirmedAt!: Date;

  @OneToMany(() => TransactionStatusHistory, (h) => h.transaction)
  statusHistory!: TransactionStatusHistory[];
}
