import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER_IN = 'transfer_in',
  TRANSFER_OUT = 'transfer_out',
  PAYLINK_RECEIVED = 'paylink_received',
  PAYLINK_SENT = 'paylink_sent',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  YIELD_CREDIT = 'yield_credit',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('transactions')
export class Transaction extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  @Column({
    name: 'amount_usdc',
    type: 'numeric',
    precision: 24,
    scale: 8,
  })
  amountUsdc!: string;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 15,
    scale: 6,
    default: 0,
  })
  amount!: number;

  @Column({ name: 'currency', length: 10, default: 'USDC' })
  currency!: string;

  @Column({ name: 'fee', type: 'varchar', nullable: true })
  fee!: string | null;

  @Column({ name: 'balance_after', type: 'varchar' })
  balanceAfter!: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status!: TransactionStatus;

  @Column({ name: 'reference', length: 100, nullable: true })
  reference!: string | null;

  @Column({ name: 'counterparty_username', type: 'varchar', nullable: true })
  counterpartyUsername!: string | null;

  @Column({ name: 'description', length: 255, nullable: true })
  description!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @Column({ name: 'deposit_id', nullable: true })
  depositId!: string | null;

  @ManyToOne('Deposit', { nullable: true })
  @JoinColumn({ name: 'deposit_id' })
  deposit!: any;
}
