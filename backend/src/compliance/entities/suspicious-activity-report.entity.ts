import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum SarReportType {
  AML_THRESHOLD = 'aml_threshold',
  VELOCITY = 'velocity',
  STRUCTURING = 'structuring',
  OTHER = 'other',
}

export enum SarStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  FILED = 'filed',
}

@Entity('suspicious_activity_reports')
@Index(['userId'])
@Index(['generatedBy'])
@Index(['status'])
export class SuspiciousActivityReport extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'generated_by', type: 'uuid' })
  generatedBy!: string;

  @Column({ name: 'report_type', type: 'enum', enum: SarReportType })
  reportType!: SarReportType;

  @Column({ type: 'text' })
  narrative!: string;

  @Column({ type: 'enum', enum: SarStatus, default: SarStatus.DRAFT })
  status!: SarStatus;

  @Column({ name: 'filed_at', type: 'timestamptz', nullable: true, default: null })
  filedAt!: Date | null;
}
