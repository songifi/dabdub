import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ActorType {
  USER = 'user',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

@Entity('audit_logs')
@Index(['resourceType', 'resourceId', 'createdAt'])
@Index(['actorId', 'createdAt'])
@Index(['action', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Who performed the action (userId, adminId, or 'system') */
  @Column({ name: 'actor_id', type: 'varchar', length: 255 })
  actorId!: string;

  @Column({ name: 'actor_type', type: 'enum', enum: ActorType })
  actorType!: ActorType;

  /** Dot-notation action name, e.g. 'kyc.approved', 'user.freeze' */
  @Column({ type: 'varchar', length: 255 })
  action!: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 100 })
  resourceType!: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 255 })
  resourceId!: string;

  /** State of the resource before the action */
  @Column({ type: 'jsonb', nullable: true, default: null })
  before!: Record<string, unknown> | null;

  /** State of the resource after the action */
  @Column({ type: 'jsonb', nullable: true, default: null })
  after!: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true, default: null })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true, default: null })
  userAgent!: string | null;

  @Column({ name: 'correlation_id', type: 'varchar', length: 255, nullable: true, default: null })
  correlationId!: string | null;

  /** Immutable — no updatedAt */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
