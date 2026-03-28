import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum TransferStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Entity('transfers')
export class Transfer extends BaseEntity {
  @Column({ name: 'from_user_id' })
  @Index()
  fromUserId!: string;

  @Column({ name: 'to_user_id' })
  @Index()
  toUserId!: string;

  @Column({ name: 'from_username', length: 50 })
  fromUsername!: string;

  @Column({ name: 'to_username', length: 50 })
  toUsername!: string;

  @Column({ name: 'amount', type: 'varchar' })
  amount!: string;

  @Column({ name: 'fee', type: 'varchar', default: '0' })
  fee!: string;

  @Column({ name: 'net_amount', type: 'varchar' })
  netAmount!: string;

  @Column({ name: 'note', length: 100, nullable: true, default: null })
  note!: string | null;

  @Column({ name: 'tx_hash', type: 'varchar', nullable: true, default: null })
  txHash!: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.PENDING,
  })
  status!: TransferStatus;
}
