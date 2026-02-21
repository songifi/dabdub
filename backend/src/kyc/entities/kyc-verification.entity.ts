import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';
import { Merchant } from '../../database/entities/merchant.entity';
import { KycDocument } from './kyc-document.entity';
import { KycAuditLog } from './kyc-audit-log.entity';

export enum KycVerificationStatus {
  NOT_STARTED = 'not_started',
  DOCUMENTS_PENDING = 'documents_pending',
  DOCUMENTS_UPLOADED = 'documents_uploaded',
  PROCESSING = 'processing',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RESUBMISSION_REQUESTED = 'resubmission_requested',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
}

export enum KycVerificationType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
  ENHANCED = 'enhanced',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

@Entity('kyc_verifications')
@Index(['merchantId'])
@Index(['status'])
@Index(['riskLevel'])
@Index(['expiresAt'])
@Index(['createdAt'])
export class KycVerification extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string;

  @Column({
    type: 'enum',
    enum: KycVerificationStatus,
    default: KycVerificationStatus.NOT_STARTED,
  })
  status!: KycVerificationStatus;

  @Column({
    name: 'verification_type',
    type: 'enum',
    enum: KycVerificationType,
    default: KycVerificationType.INDIVIDUAL,
  })
  verificationType!: KycVerificationType;

  @Column({
    name: 'risk_level',
    type: 'enum',
    enum: RiskLevel,
    nullable: true,
  })
  riskLevel!: RiskLevel;

  @Column({
    name: 'risk_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  riskScore!: number;

  // Personal Information (encrypted)
  @Column({ name: 'first_name', type: 'varchar', length: 255, nullable: true })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 255, nullable: true })
  lastName!: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth!: Date;

  @Column({ name: 'nationality', type: 'varchar', length: 100, nullable: true })
  nationality!: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 50, nullable: true })
  phoneNumber!: string;

  // Address Information
  @Column({ name: 'address_line1', type: 'varchar', length: 255, nullable: true })
  addressLine1!: string;

  @Column({ name: 'address_line2', type: 'varchar', length: 255, nullable: true })
  addressLine2!: string;

  @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
  city!: string;

  @Column({ name: 'state_province', type: 'varchar', length: 100, nullable: true })
  stateProvince!: string;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode!: string;

  @Column({ name: 'country', type: 'varchar', length: 100, nullable: true })
  country!: string;

  // Business Information (for business verification)
  @Column({ name: 'business_name', type: 'varchar', length: 255, nullable: true })
  businessName!: string;

  @Column({ name: 'business_registration_number', type: 'varchar', length: 100, nullable: true })
  businessRegistrationNumber!: string;

  @Column({ name: 'business_type', type: 'varchar', length: 100, nullable: true })
  businessType!: string;

  @Column({ name: 'business_country', type: 'varchar', length: 100, nullable: true })
  businessCountry!: string;

  @Column({ name: 'business_address', type: 'text', nullable: true })
  businessAddress!: string;

  // Verification Provider Information
  @Column({ name: 'provider_name', type: 'varchar', length: 100, nullable: true })
  providerName!: string;

  @Column({ name: 'provider_reference', type: 'varchar', length: 255, nullable: true })
  providerReference!: string;

  @Column({ name: 'provider_status', type: 'varchar', length: 100, nullable: true })
  providerStatus!: string;

  @Column({ name: 'provider_response', type: 'jsonb', nullable: true })
  providerResponse!: Record<string, any>;

  // Sanctions and Watchlist Screening
  @Column({ name: 'sanctions_checked', type: 'boolean', default: false })
  sanctionsChecked!: boolean;

  @Column({ name: 'sanctions_clear', type: 'boolean', nullable: true })
  sanctionsClear!: boolean;

  @Column({ name: 'sanctions_details', type: 'jsonb', nullable: true })
  sanctionsDetails!: Record<string, any>;

  // Review Information
  @Column({ name: 'reviewer_id', type: 'uuid', nullable: true })
  reviewerId!: string;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes!: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string;

  @Column({ name: 'rejection_code', type: 'varchar', length: 50, nullable: true })
  rejectionCode!: string;

  // Timestamps
  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt!: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt!: Date;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt!: Date;

  @Column({ name: 'rejected_at', type: 'timestamp', nullable: true })
  rejectedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt!: Date;

  @Column({ name: 'next_review_at', type: 'timestamp', nullable: true })
  nextReviewAt!: Date;

  // Metadata
  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, any>;

  @Column({ name: 'compliance_flags', type: 'jsonb', nullable: true })
  complianceFlags!: Record<string, any>;

  // Relationships
  @ManyToOne(() => Merchant, (merchant) => merchant.kycVerifications)
  @JoinColumn({ name: 'merchant_id' })
  merchant!: Merchant;

  @OneToMany(() => KycDocument, (document) => document.kycVerification)
  documents!: KycDocument[];

  @OneToMany(() => KycAuditLog, (auditLog) => auditLog.kycVerification)
  auditLogs!: KycAuditLog[];
}
