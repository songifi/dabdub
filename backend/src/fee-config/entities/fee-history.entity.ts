import { Entity, Column, CreateDateColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum FeeChangeType {
  GLOBAL = 'global',
  MERCHANT_OVERRIDE = 'merchant_override',
}

@Entity('fee_histories')
@Index(['feeType', 'createdAt'])
@Index(['merchantId', 'createdAt'])
@Index(['actorId', 'createdAt'])
export class FeeHistory extends BaseEntity {
  @Column({
    name: 'fee_type',
    type: 'varchar',
    length: 50,
  })
  feeType!: string;

  @Column({
    name: 'change_type',
    type: 'enum',
    enum: FeeChangeType,
  })
  changeType!: FeeChangeType;

  /** Merchant ID for per-merchant overrides; null for global changes */
  @Column({
    name: 'merchant_id',
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null,
  })
  merchantId!: string | null;

  @Column({
    name: 'previous_value',
    type: 'numeric',
    precision: 7,
    scale: 6,
  })
  previousValue!: string;

  @Column({
    name: 'new_value',
    type: 'numeric',
    precision: 7,
    scale: 6,
  })
  newValue!: string;

  /** Who performed the action (adminId) */
  @Column({ name: 'actor_id', type: 'varchar', length: 255 })
  actorId!: string;

  @Column({
    name: 'actor_type',
    type: 'varchar',
    length: 50,
    default: 'admin',
  })
  actorType!: string;

  @Column({
    name: 'reason',
    type: 'text',
    nullable: true,
    default: null,
  })
  reason!: string | null;

}

