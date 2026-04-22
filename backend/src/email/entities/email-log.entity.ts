import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum EmailStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity('email_logs')
export class EmailLog extends BaseEntity {
  @Column({ name: 'user_id', type: 'varchar', nullable: true, default: null })
  userId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  to!: string;

  @Column({ name: 'template_alias', type: 'varchar', length: 100 })
  templateAlias!: string;

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @Column({ type: 'enum', enum: EmailStatus, default: EmailStatus.QUEUED })
  status!: EmailStatus;

  @Column({ name: 'provider_message_id', type: 'varchar', nullable: true, default: null })
  providerMessageId!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true, default: null })
  errorMessage!: string | null;

  @Column({ name: 'attempt_count', default: 0 })
  attemptCount!: number;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true, default: null })
  sentAt!: Date | null;
}
