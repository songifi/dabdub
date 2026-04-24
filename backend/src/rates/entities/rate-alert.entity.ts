import {
  Column,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum AlertDirection {
  ABOVE = 'above',
  BELOW = 'below',
}

export enum AlertStatus {
  ACTIVE = 'active',
  TRIGGERED = 'triggered',
  CANCELLED = 'cancelled',
}

@Entity('rate_alerts')
@Index(['userId'])
export class RateAlert extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'target_rate' })
  targetRate!: string;

  @Column({ type: 'enum', enum: AlertDirection })
  direction!: AlertDirection;

  @Column({ type: 'varchar', length: 10, default: 'NGN' })
  currency!: string;

  @Column({ type: 'enum', enum: AlertStatus, default: AlertStatus.ACTIVE })
  status!: AlertStatus;

  @Column({ name: 'triggered_at', type: 'timestamptz', nullable: true, default: null })
  triggeredAt!: Date | null;

  @Column({ name: 'notified_via', type: 'jsonb', default: [] })
  notifiedVia!: string[];
}
