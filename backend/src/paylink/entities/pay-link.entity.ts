import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum PayLinkStatus {
  ACTIVE = 'active',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('pay_links')
export class PayLink extends BaseEntity {
  @Column({ name: 'creator_user_id', type: 'uuid' })
  creatorUserId!: string;

  @Index({ unique: true })
  @Column({ name: 'token_id', length: 64, unique: true })
  tokenId!: string;

  @Column({ type: 'varchar', length: 64 })
  amount!: string;

  @Column({ type: 'varchar', length: 200, nullable: true, default: null })
  note!: string | null;

  @Column({
    type: 'enum',
    enum: PayLinkStatus,
    default: PayLinkStatus.ACTIVE,
  })
  status!: PayLinkStatus;

  @Column({
    name: 'paid_by_user_id',
    type: 'uuid',
    nullable: true,
    default: null,
  })
  paidByUserId!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'created_tx_hash', length: 160 })
  createdTxHash!: string;

  @Column({
    name: 'payment_tx_hash',
    length: 160,
    nullable: true,
    default: null,
  })
  paymentTxHash!: string | null;

  @Column({ name: 'sandbox', type: 'boolean', default: false })
  sandbox!: boolean;
}
