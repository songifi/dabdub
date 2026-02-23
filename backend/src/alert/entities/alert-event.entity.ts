import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AlertRule } from './alert-rule.entity';
import { BaseEntity } from 'src/database/entities/base.entity';
import { AlertEventStatus } from '../enums/alert.enums';

@Entity('alert_events')
@Index(['ruleId'])
@Index(['status'])
@Index(['createdAt'])
export class AlertEvent extends BaseEntity {
  @Column({ type: 'uuid' })
  ruleId: string;

  @ManyToOne(() => AlertRule, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ruleId' })
  rule: AlertRule;

  /** The live metric value that breached the threshold */
  @Column({ type: 'decimal', precision: 20, scale: 8 })
  triggerValue: string;

  /** The configured threshold at time of firing */
  @Column({ type: 'decimal', precision: 20, scale: 8 })
  thresholdValue: string;

  @Column({
    type: 'enum',
    enum: AlertEventStatus,
    default: AlertEventStatus.ACTIVE,
  })
  status: AlertEventStatus;

  @Column({ type: 'uuid', nullable: true })
  acknowledgedById: string | null;

  @Column({ type: 'text', nullable: true })
  acknowledgmentNote: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedById: string | null;

  @Column({ type: 'text', nullable: true })
  resolutionNote: string | null;

  @Column({ type: 'uuid', nullable: true })
  incidentId: string | null;
}
