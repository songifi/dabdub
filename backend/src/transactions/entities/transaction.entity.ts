import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TransactionStatus, TransactionType } from '../transactions.enums';
import { PaymentRequest } from '../../database/entities/payment-request.entity';

@Entity('transactions')
@Index(['txHash'])
@Index(['network'])
@Index(['status'])
@Index(['network', 'status'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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

  @Column({ name: 'usd_value', type: 'decimal', precision: 18, scale: 2, nullable: true })
  usdValue!: number;

  @Column({ name: 'fiat_amount', type: 'decimal', precision: 18, scale: 2, nullable: true })
  fiatAmount!: number;

  // --- CONFIRMATIONS ---
  @Column({ name: 'block_number', type: 'bigint', nullable: true })
  blockNumber!: number;

  @Column({ type: 'int', default: 0 })
  confirmations!: number;

  @Column({ name: 'required_confirmations', type: 'int', default: 12 })
  requiredConfirmations!: number;

  // --- GAS & RECEIPTS ---
  @Column({ name: 'fee_amount', type: 'decimal', precision: 36, scale: 18, nullable: true })
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
  confirmedAt!: Date;
}