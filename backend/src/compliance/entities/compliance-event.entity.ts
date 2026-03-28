import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum ComplianceEventType {
  AML_THRESHOLD = 'aml_threshold',
  VOLUME_BREACH = 'volume_breach',
  IDENTITY_UNVERIFIED = 'identity_unverified',
  PEP_MATCH = 'pep_match',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',
  STRUCTURING = 'structuring',
  VELOCITY = 'velocity',
  OTHER = 'other',
}

export enum ComplianceEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ComplianceEventStatus {
  OPEN = 'open',
  REVIEWING = 'reviewing',
  CLEARED = 'cleared',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
}

@Entity('compliance_events')
@Index(['userId'])
@Index(['status'])
@Index(['type'])
export class ComplianceEvent extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'event_type', type: 'enum', enum: ComplianceEventType })
  eventType!: ComplianceEventType;

  @Column({ type: 'enum', enum: ComplianceEventSeverity })
  severity!: ComplianceEventSeverity;

  @Column({
    type: 'enum',
    enum: ComplianceEventStatus,
    default: ComplianceEventStatus.OPEN,
  })
  status!: ComplianceEventStatus;

  @Column({ name: 'tx_id', type: 'uuid', nullable: true, default: null })
  txId!: string | null;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true, default: null })
  reviewedBy!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  /** @deprecated use reviewedBy */
  @Column({ name: 'resolved_by', type: 'uuid', nullable: true, default: null })
  resolvedBy!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true, default: null })
  resolvedAt!: Date | null;
}
