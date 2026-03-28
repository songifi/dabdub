import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import type { WebhookEvent } from '../webhooks.events';

@Entity('webhook_subscriptions')
@Index(['userId', 'isActive'])
export class WebhookSubscription extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'text', array: true })
  events!: WebhookEvent[];

  /**
   * Stored as SHA-256 hash of the raw secret (hex).
   * Raw secret is returned once at creation time only.
   */
  @Column({ type: 'varchar', length: 64 })
  secret!: string;

  /** AES-256-GCM encrypted raw secret, used for signing deliveries. */
  @Column({ name: 'secret_enc', type: 'text' })
  secretEnc!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
