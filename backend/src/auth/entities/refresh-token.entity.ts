import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('refresh_tokens')
@Index(['sessionId'])
@Index(['userId'])
export class RefreshToken extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  /** SHA-256 hash of the raw refresh token value stored in the JWT. */
  @Column({ name: 'token_hash', length: 64 })
  tokenHash!: string;

  /** Groups access + refresh pair for a single device session. */
  @Column({ name: 'session_id' })
  sessionId!: string;

  @Column({ name: 'device_info', type: 'jsonb', nullable: true })
  deviceInfo!: Record<string, unknown> | null;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true, default: null })
  revokedAt!: Date | null;
}
