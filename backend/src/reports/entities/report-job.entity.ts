import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum ReportType {
  USER_TRANSACTIONS = 'user_transactions',
  MERCHANT_SETTLEMENTS = 'merchant_settlements',
  FEE_SUMMARY = 'fee_summary',
  KYC_SUBMISSIONS = 'kyc_submissions',
  WAITLIST_EXPORT = 'waitlist_export',
}

export enum ReportStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

export interface ReportParams {
  dateFrom?: string;
  dateTo?: string;
  filters?: Record<string, unknown>;
}

@Entity('report_jobs')
@Index(['requestedBy'])
@Index(['status'])
export class ReportJob extends BaseEntity {
  @Column({ name: 'requested_by' })
  requestedBy!: string;

  @Column({ type: 'enum', enum: ReportType })
  type!: ReportType;

  @Column({ type: 'jsonb', default: {} })
  params!: ReportParams;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.QUEUED })
  status!: ReportStatus;

  @Column({ name: 'file_key', nullable: true, default: null })
  fileKey!: string | null;

  @Column({ name: 'file_url', type: 'text', nullable: true, default: null })
  fileUrl!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true, default: null })
  expiresAt!: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true, default: null })
  errorMessage!: string | null;
}
