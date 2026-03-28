import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum ComplianceEventType {
  AML_THRESHOLD = 'aml_threshold',
  VELOCITY = 'velocity',
  STRUCTURING = 'structuring',
  OTHER = 'other',
}

export enum ComplianceEventSeverity {
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ComplianceEventStatus {
  OPEN = 'open',
  REVIEWING = 'reviewing',
  RESOLVED = 'resolved',
}

@Entity('compliance_events')
@Index(['userId'])
@Index(['status'])
@Index(['type'])
export class ComplianceEvent extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: ComplianceEventType })
  type!: ComplianceEventType;

  @Column({ type: 'enum', enum: ComplianceEventSeverity })
  severity!: ComplianceEventSeverity;

  @Column({
    type: 'enum',
    enum: ComplianceEventStatus,
    default: ComplianceEventStatus.OPEN,
  })
  status!: ComplianceEventStatus;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true, default: null })
  resolvedBy!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true, default: null })
  resolvedAt!: Date | null;
}
