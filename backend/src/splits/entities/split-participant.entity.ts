import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum SplitParticipantStatus {
  PENDING = 'pending',
  PAID = 'paid',
  DECLINED = 'declined',
}

@Entity('split_participants')
export class SplitParticipant extends BaseEntity {
  @Index()
  @Column({ name: 'split_request_id', type: 'uuid' })
  splitRequestId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ length: 50 })
  username!: string;

  @Column({ name: 'amount_owed_usdc', type: 'varchar' })
  amountOwedUsdc!: string;

  @Column({ type: 'enum', enum: SplitParticipantStatus, default: SplitParticipantStatus.PENDING })
  status!: SplitParticipantStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true, default: null })
  paidAt!: Date | null;

  @Column({ name: 'tx_hash', type: 'varchar', nullable: true, default: null })
  txHash!: string | null;
}
