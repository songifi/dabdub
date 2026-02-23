import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Incident } from './incident.entity';
import { BaseEntity } from 'src/database/entities/base.entity';
import { TimelineEntryType } from '../enums/incident.enums';

@Entity('incident_timeline_entries')
@Index(['incidentId'])
@Index(['createdAt'])
export class IncidentTimelineEntry extends BaseEntity {
  @Column({ type: 'uuid' })
  incidentId: string;

  @ManyToOne(() => Incident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incidentId' })
  incident: Incident;

  @Column({ type: 'uuid' })
  adminId: string;

  @Column({ type: 'enum', enum: TimelineEntryType })
  type: TimelineEntryType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
