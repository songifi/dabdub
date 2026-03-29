import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

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
export class RateAlert extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

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
