import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';
import { DeletionRequestStatus } from '../enums/deletion-request-status.enum';

@Entity('data_deletion_requests')
export class DataDeletionRequest extends BaseEntity {
  @Column()
  merchantId: string;

  @Column({ type: 'enum', enum: DeletionRequestStatus })
  status: DeletionRequestStatus;

  @Column({ type: 'text' })
  requestReason: string;

  @Column({ nullable: true })
  reviewedById: string | null;

  @Column({ type: 'text', nullable: true })
  reviewNote: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  legalHoldExpiresAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  deletedDataSummary: Record<string, number> | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
