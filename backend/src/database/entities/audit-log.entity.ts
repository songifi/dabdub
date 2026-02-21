import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuditAction, ActorType, DataClassification } from './audit-log.enums';

@Entity('compliance_audit_logs')
@Index(['entityType', 'entityId'])
@Index(['actorId'])
@Index(['createdAt'])
@Index(['requestId'])
@Index(['entityType', 'createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 100 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({
    name: 'actor_type',
    type: 'enum',
    enum: ActorType,
  })
  actorType: ActorType;

  @Column({ name: 'before_state', type: 'jsonb', nullable: true })
  beforeState: Record<string, unknown> | null;

  @Column({ name: 'after_state', type: 'jsonb', nullable: true })
  afterState: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 100, nullable: true })
  requestId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({
    name: 'data_classification',
    type: 'enum',
    enum: DataClassification,
    default: DataClassification.NORMAL,
  })
  dataClassification: DataClassification;

  @Column({ name: 'retention_until', type: 'timestamptz', nullable: true })
  retentionUntil: Date | null;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
