import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum EmailStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  to!: string;

  @Column({ name: 'template_alias' })
  templateAlias!: string;

  @Column()
  subject!: string;

  @Column({ type: 'enum', enum: EmailStatus, default: EmailStatus.QUEUED })
  status!: EmailStatus;

  @Column({ name: 'user_id', type: 'varchar', length: 255, nullable: true })
  userId!: string | null;

  @Column({ name: 'provider_message_id', nullable: true })
  providerMessageId!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'attempt_count', default: 0 })
  attemptCount!: number;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
