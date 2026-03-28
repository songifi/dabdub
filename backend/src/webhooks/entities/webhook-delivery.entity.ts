import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import type { WebhookEvent } from '../webhooks.events';
import { WebhookSubscription } from './webhook-subscription.entity';

@Entity('webhook_deliveries')
@Index(['subscriptionId', 'createdAt'])
@Index(['nextRetryAt'])
export class WebhookDelivery extends BaseEntity {
  @Column({ name: 'subscription_id' })
  subscriptionId!: string;

  @ManyToOne(() => WebhookSubscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscription_id' })
  subscription!: WebhookSubscription;

  @Column({ type: 'text' })
  event!: WebhookEvent;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({
    name: 'response_status',
    type: 'int',
    nullable: true,
    default: null,
  })
  responseStatus!: number | null;

  @Column({
    name: 'response_body',
    type: 'varchar',
    nullable: true,
    default: null,
  })
  responseBody!: string | null;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Column({
    name: 'delivered_at',
    type: 'timestamptz',
    nullable: true,
    default: null,
  })
  deliveredAt!: Date | null;

  @Column({ name: 'next_retry_at', type: 'timestamptz' })
  nextRetryAt!: Date;
}
