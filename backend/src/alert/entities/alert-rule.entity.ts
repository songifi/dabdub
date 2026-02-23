import { UserRole } from 'src/database/entities/user.entity';
import { Entity, Column, Index } from 'typeorm';
import {
  AlertMetric,
  AlertCondition,
  AlertSeverity,
} from '../enums/alert.enums';
import { BaseEntity } from 'src/database/entities/base.entity';

@Entity('alert_rules')
@Index(['metric'])
@Index(['isEnabled'])
@Index(['severity'])
export class AlertRule extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: AlertMetric })
  metric: AlertMetric;

  @Column({ type: 'jsonb' })
  conditions: AlertCondition;

  @Column({ type: 'enum', enum: AlertSeverity })
  severity: AlertSeverity;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  /** Which admin roles get notified when this alert fires */
  @Column({ type: 'jsonb', default: [] })
  notifyRoles: UserRole[];

  /** Minimum minutes before the same rule can fire again */
  @Column({ type: 'int', default: 5 })
  cooldownMinutes: number;

  /** If true: automatically escalate to an Incident when this alert fires */
  @Column({ type: 'boolean', default: false })
  autoCreateIncident: boolean;
}
