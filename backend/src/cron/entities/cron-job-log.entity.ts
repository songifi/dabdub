import { Entity, Column, CreateDateColumn, PrimaryGeneratedColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum CronJobStatus {
  STARTED = 'started',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('cron_job_logs')
@Index(['jobName', 'startedAt'])
export class CronJobLog extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  jobName!: string;

  @Column({
    type: 'enum',
    enum: CronJobStatus,
    default: CronJobStatus.STARTED,
  })
  status!: CronJobStatus;

  @CreateDateColumn({ name: 'started_at' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ name: 'duration_ms', type: 'int' })
  durationMs!: number;

  @Column({ name: 'error_message', length: 1000, nullable: true })
  errorMessage?: string;

  @Column({ name: 'items_processed', type: 'int', nullable: true })
  itemsProcessed?: number;
}

