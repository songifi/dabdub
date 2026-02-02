import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';
import { KycVerification } from './kyc-verification.entity';

export enum DocumentType {
  PASSPORT = 'passport',
  DRIVERS_LICENSE = 'drivers_license',
  NATIONAL_ID = 'national_id',
  UTILITY_BILL = 'utility_bill',
  BANK_STATEMENT = 'bank_statement',
  BUSINESS_REGISTRATION = 'business_registration',
  ARTICLES_OF_INCORPORATION = 'articles_of_incorporation',
  MEMORANDUM_OF_ASSOCIATION = 'memorandum_of_association',
  CERTIFICATE_OF_INCORPORATION = 'certificate_of_incorporation',
  TAX_CERTIFICATE = 'tax_certificate',
  PROOF_OF_ADDRESS = 'proof_of_address',
  SELFIE = 'selfie',
  OTHER = 'other',
}

export enum DocumentStatus {
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum DocumentQuality {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
}

@Entity('kyc_documents')
@Index(['kycVerificationId'])
@Index(['documentType'])
@Index(['status'])
@Index(['expiresAt'])
export class KycDocument extends BaseEntity {
  @Column({ name: 'kyc_verification_id', type: 'uuid' })
  kycVerificationId!: string;

  @Column({
    name: 'document_type',
    type: 'enum',
    enum: DocumentType,
  })
  documentType!: DocumentType;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.UPLOADED,
  })
  status!: DocumentStatus;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath!: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize!: number;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'file_hash', type: 'varchar', length: 128 })
  fileHash!: string;

  // Document Quality Assessment
  @Column({
    name: 'quality_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  qualityScore!: number;

  @Column({
    name: 'quality_rating',
    type: 'enum',
    enum: DocumentQuality,
    nullable: true,
  })
  qualityRating!: DocumentQuality;

  @Column({ name: 'quality_issues', type: 'jsonb', nullable: true })
  qualityIssues!: string[];

  // OCR Extracted Data
  @Column({ name: 'ocr_text', type: 'text', nullable: true })
  ocrText!: string;

  @Column({ name: 'extracted_data', type: 'jsonb', nullable: true })
  extractedData!: Record<string, any>;

  @Column({ name: 'ocr_confidence', type: 'decimal', precision: 5, scale: 2, nullable: true })
  ocrConfidence!: number;

  // Document Verification
  @Column({ name: 'document_number', type: 'varchar', length: 100, nullable: true })
  documentNumber!: string;

  @Column({ name: 'issue_date', type: 'date', nullable: true })
  issueDate!: Date;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate!: Date;

  @Column({ name: 'issuing_authority', type: 'varchar', length: 255, nullable: true })
  issuingAuthority!: string;

  @Column({ name: 'issuing_country', type: 'varchar', length: 100, nullable: true })
  issuingCountry!: string;

  // Verification Results
  @Column({ name: 'is_authentic', type: 'boolean', nullable: true })
  isAuthentic!: boolean;

  @Column({ name: 'is_expired', type: 'boolean', default: false })
  isExpired!: boolean;

  @Column({ name: 'verification_provider', type: 'varchar', length: 100, nullable: true })
  verificationProvider!: string;

  @Column({ name: 'verification_reference', type: 'varchar', length: 255, nullable: true })
  verificationReference!: string;

  @Column({ name: 'verification_result', type: 'jsonb', nullable: true })
  verificationResult!: Record<string, any>;

  // Processing Information
  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt!: Date;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt!: Date;

  // Rejection Information
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string;

  @Column({ name: 'rejection_code', type: 'varchar', length: 50, nullable: true })
  rejectionCode!: string;

  // Metadata
  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, any>;

  // Relationships
  @ManyToOne(() => KycVerification, (verification) => verification.documents)
  @JoinColumn({ name: 'kyc_verification_id' })
  kycVerification!: KycVerification;
}