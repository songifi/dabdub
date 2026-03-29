import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum WithdrawalStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Entity('withdrawals')
export class Withdrawal extends BaseEntity {
  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'to_address', length: 60 })
  toAddress!: string;

  @Column({ type: 'varchar', length: 50 })
  amount!: string;

  @Column({ type: 'varchar', length: 50 })
  fee!: string;

  @Column({ name: 'net_amount', type: 'varchar', length: 50 })
  netAmount!: string;

  @Column({ name: 'fee_config_id', nullable: true })
  feeConfigId!: string | null;

  @Column({ name: 'tx_hash', length: 100, nullable: true })
  txHash!: string | null;

  @Column({
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PENDING,
  })
  status!: WithdrawalStatus;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string | null;
}
