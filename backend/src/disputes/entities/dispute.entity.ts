import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum DisputeType {
  UNAUTHORIZED = 'unauthorized',
  WRONG_AMOUNT = 'wrong_amount',
  DUPLICATE = 'duplicate',
  NOT_RECEIVED = 'not_received',
  OTHER = 'other',
}

export enum DisputeStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  RESOLVED_APPROVED = 'resolved_approved',
  RESOLVED_REJECTED = 'resolved_rejected',
}

@Entity('disputes')
export class Dispute extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  @Column({ type: 'enum', enum: DisputeType })
  type!: DisputeType;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status!: DisputeStatus;

  @Column({ type: 'varchar', nullable: true, default: null })
  resolution!: string | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true, default: null })
  resolvedBy!: string | null;

  @Column({ name: 'reversal_tx_hash', type: 'varchar', nullable: true, default: null })
  reversalTxHash!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true, default: null })
  resolvedAt!: Date | null;
}
