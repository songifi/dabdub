import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum SmsStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity('sms_logs')
export class SmsLog extends BaseEntity {
  @Column({ name: 'user_id', type: 'varchar', nullable: true, default: null })
  userId!: string | null;

  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ type: 'varchar', length: 160 })
  message!: string;

  @Column({ type: 'enum', enum: SmsStatus, default: SmsStatus.QUEUED })
  status!: SmsStatus;

  @Column({ type: 'varchar', length: 100, default: 'termii' })
  provider!: string;

  @Column({ name: 'provider_ref', type: 'varchar', nullable: true, default: null })
  providerRef!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true, default: null })
  errorMessage!: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true, default: null })
  sentAt!: Date | null;
}
