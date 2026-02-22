import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';

@Entity('data_retention_policies')
export class DataRetentionPolicy extends BaseEntity {
  @Column({ unique: true })
  dataType: string;

  @Column({ type: 'int' })
  retentionDays: number;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'text' })
  legalBasis: string;

  @Column({ type: 'boolean', default: false })
  archiveBeforeDelete: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastPurgeRunAt: Date | null;

  @Column({ type: 'int', nullable: true })
  lastPurgeDeletedCount: number | null;
}
