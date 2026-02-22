import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { Merchant } from './merchant.entity';
import { Settlement } from '../../settlement/entities/settlement.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

export interface PaymentRequestQrCodeData {
  uri: string;
  format: 'sep0007';
  imageBase64?: string;
}

export enum PaymentRequestStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  REFUNDED = 'refunded',
}

export enum PaymentRequestType {
  PAYMENT = 'payment',
  REFUND = 'refund',
}

@Entity('payment_requests')
@Index(['merchantId'])
@Index(['status'])
@Index(['createdAt'])
@Index(['expiresAt'])
@Index(['stellarNetwork'])
@Index(['customerEmail'])
@Index(['idempotencyKey'], {
  unique: true,
  where: '"idempotency_key" IS NOT NULL',
})
@Index(['onChainPaymentId'], {
  unique: true,
  where: '"on_chain_payment_id" IS NOT NULL',
})
@Index(['onChainTxHash', 'stellarNetwork'], {
  unique: true,
  where: '"on_chain_tx_hash" IS NOT NULL AND "stellar_network" IS NOT NULL',
})
@Index(['isSandbox'])
export class PaymentRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'is_sandbox', type: 'boolean', default: false })
  isSandbox!: boolean;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string;

  @Column({ type: 'decimal', precision: 19, scale: 7 })
  amount!: number;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({
    type: 'enum',
    enum: PaymentRequestStatus,
    default: PaymentRequestStatus.PENDING,
  })
  status!: PaymentRequestStatus;

  @Column({
    type: 'enum',
    enum: PaymentRequestType,
    default: PaymentRequestType.PAYMENT,
  })
  type!: PaymentRequestType;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string;

  @Column({
    name: 'stellar_network',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  stellarNetwork!: string;

  @Column({
    name: 'on_chain_payment_id',
    type: 'varchar',
    length: 64,
    unique: false,
    nullable: true,
  })
  onChainPaymentId!: string;

  @Column({
    name: 'on_chain_tx_hash',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  onChainTxHash!: string;

  @Column({
    name: 'block_number',
    type: 'bigint',
    nullable: true,
  })
  blockNumber!: string | null;

  @Column({ type: 'int', nullable: true })
  confirmations!: number | null;

  @Column({
    name: 'user_wallet_address',
    type: 'varchar',
    length: 56,
    nullable: true,
  })
  userWalletAddress!: string;

  @Column({
    name: 'fee_amount',
    type: 'decimal',
    precision: 19,
    scale: 7,
    default: 0,
  })
  feeAmount!: number;

  @Column({
    name: 'customer_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  customerName!: string;

  @Column({
    name: 'customer_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  customerEmail!: string;

  @Column({
    name: 'customer_phone',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  customerPhone!: string;

  @Column({
    name: 'customer_wallet_address',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  customerWalletAddress!: string | null;

  @Column({
    name: 'customer_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  customerId!: string | null;

  @Column({
    name: 'webhook_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  webhookUrl!: string | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt!: Date;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt!: Date;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  idempotencyKey!: string;

  @Column({ name: 'qr_code_data', type: 'jsonb', nullable: true })
  qrCodeData!: PaymentRequestQrCodeData | null;

  @Column({ name: 'status_history', type: 'jsonb', default: '[]' })
  statusHistory!: Array<{ status: string; timestamp: string; reason?: string }>;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relationships
  @ManyToOne(() => Merchant, (merchant) => merchant.paymentRequests)
  @JoinColumn({ name: 'merchant_id' })
  merchant!: Merchant;

  @OneToOne(() => Settlement, (settlement) => settlement.paymentRequest)
  settlement!: Settlement;

  @OneToMany(() => Transaction, (transaction) => transaction.paymentRequest)
  transactions!: Transaction[];
}
