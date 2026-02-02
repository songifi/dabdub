import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';
import { KycVerification } from './kyc-verification.entity';

export enum AuditAction {
  VERIFICATION_CREATED = 'verification_created',
  DOCUMENT_UPLOADED = 'document_uploaded',
  DOCUMENT_PROCESSED = 'document_processed',
  DOCUMENT_VERIFIED = 'document_verified',
  DOCUMENT_REJECTED = 'document_rejected',
  OCR_COMPLETED = 'ocr_completed',
  IDENTITY_VERIFIED = 'identity_verified',
  BUSINESS_VERIFIED = 'business_verified',
  SANCTIONS_CHECKED = 'sanctions_checked',
  RISK_ASSESSED = 'risk_assessed',
  STATUS_CHANGED = 'status_changed',
  MANUAL_REVIEW_STARTED = 'manual_review_started',
  MANUAL_REVIEW_COMPLETED = 'manual_review_completed',
  VERIFICATION_APPROVED = 'verification_approved',
  VERIFICATION_REJECTED = 'verification_rejected',
  VERIFICATION_EXPIRED = 'verification_expired',
  VERIFICATION_SUSPENDED = 'verification_suspended',
  DATA_UPDATED = 'data_updated',
  COMPLIANCE_FLAG_ADDED = 'compliance_flag_added',
  COMPLIANCE_FLAG_REMOVED = 'compliance_flag_removed',
  DOCUMENT_EXPIRED = 'document_expired',
  RE_VERIFICATION_TRIGGERED = 're_verification_triggered',
}

@Entity('kyc_audit_logs')
@Index(['kycVerificationId'])
@Index(['action'])
@Index(['userId'])
@Index(['createdAt'])
@Index(['ipAddress'])
export class KycAuditLog extends BaseEntity {
  @Column({ name: 'kyc_verification_id', type: 'uuid' })
  kycVerificationId!: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action!: AuditAction;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string;

  @Column({ name: 'user_type', type: 'varchar', length: 50, nullable: true })
  userType!: string; // 'system', 'admin', 'reviewer', 'merchant'

  @Column({ name: 'description', type: 'text' })
  description!: string;

  // Request Context
  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress!: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string;

  @Column({ name: 'request_id', type: 'varchar', length: 100, nullable: true })
  requestId!: string;

  // Data Changes
  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues!: Record<string, any>;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues!: Record<string, any>;

  @Column({ name: 'changed_fields', type: 'jsonb', nullable: true })
  changedFields!: string[];

  // Additional Context
  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, any>;

  @Column({ name: 'error_details', type: 'jsonb', nullable: true })
  errorDetails!: Record<string, any>;

  // Compliance and Security
  @Column({ name: 'compliance_relevant', type: 'boolean', default: true })
  complianceRelevant!: boolean;

  @Column({ name: 'sensitive_data_accessed', type: 'boolean', default: false })
  sensitiveDataAccessed!: boolean;

  @Column({ name: 'data_retention_date', type: 'timestamp', nullable: true })
  dataRetentionDate!: Date;

  // Relationships
  @ManyToOne(() => KycVerification, (verification) => verification.auditLogs)
  @JoinColumn({ name: 'kyc_verification_id' })
  kycVerification!: KycVerification;
}