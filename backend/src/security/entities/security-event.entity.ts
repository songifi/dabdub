import { Entity, Column, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';
import { SecurityEventType } from '../enums';

@Entity('security_events')
export class SecurityEvent extends BaseEntity {
  @Column({ nullable: true })
  merchantId: string | null;

  @Column({ nullable: true })
  adminId: string | null;

  @Column({ type: 'enum', enum: SecurityEventType })
  type: SecurityEventType;

  @Column()
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  wasBlocked: boolean;
}
