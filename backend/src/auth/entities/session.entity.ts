import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('sessions')
@Index(['userId'])
export class Session extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'refresh_token_id' })
  refreshTokenId!: string;

  @Column({ name: 'device_info', type: 'jsonb', nullable: true })
  deviceInfo!: Record<string, unknown> | null;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', default: () => 'NOW()' })
  lastSeenAt!: Date;
}
