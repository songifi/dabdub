import { BaseEntity } from 'src/database/entities/base.entity';
import { Entity, Column, Index } from 'typeorm';
import { IncidentSeverity, IncidentStatus } from '../enums/incident.enums';

@Entity('incidents')
@Index(['status'])
@Index(['severity'])
@Index(['assignedToId'])
@Index(['createdAt'])
export class Incident extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: IncidentSeverity })
  severity: IncidentSeverity;

  @Column({ type: 'enum', enum: IncidentStatus, default: IncidentStatus.OPEN })
  status: IncidentStatus;

  @Column({ type: 'uuid', nullable: true })
  assignedToId: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ type: 'boolean', default: false })
  isAutoCreated: boolean;

  @Column({ type: 'jsonb', default: [] })
  affectedServices: string[];

  @Column({ type: 'jsonb', default: [] })
  alertEventIds: string[];

  @Column({ type: 'timestamptz', nullable: true })
  detectedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  mitigatedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  /** Minutes from detectedAt → acknowledgedAt */
  @Column({ type: 'int', nullable: true })
  timeToAcknowledgeMinutes: number | null;

  /** Minutes from detectedAt → resolvedAt (MTTR) */
  @Column({ type: 'int', nullable: true })
  timeToResolutionMinutes: number | null;
}
