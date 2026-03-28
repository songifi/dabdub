import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum SplitRequestStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('split_requests')
export class SplitRequest extends BaseEntity {
  @Index()
  @Column({ name: 'initiator_id', type: 'uuid' })
  initiatorId!: string;

  @Column({ length: 100 })
  title!: string;

  @Column({ name: 'total_amount_usdc', type: 'varchar' })
  totalAmountUsdc!: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  note!: string | null;

  @Column({ type: 'enum', enum: SplitRequestStatus, default: SplitRequestStatus.ACTIVE })
  status!: SplitRequestStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
