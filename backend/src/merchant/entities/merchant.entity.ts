import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from 'class-validator';
import { Settlement } from '../../settlement/entities/settlement.entity';

import { MerchantNote } from '../../merchant/entities/merchant-note.entity';
import { ApiKey } from '../../api-key/entities/api-key.entity';
import { MerchantDocument } from '../../merchant/entities/merchant-document.entity';
import { DocumentRequest } from '../../merchant/entities/document-request.entity';
import { UserEntity } from 'src/database/entities/user.entity';
import { WebhookConfigurationEntity } from 'src/database/entities/webhook-configuration.entity';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum MerchantStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CLOSED = 'closed',
  INACTIVE = 'inactive',
  TERMINATED = 'terminated',
}

export enum KycStatus {
  NOT_SUBMITTED = 'not_submitted',
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  RESUBMISSION_REQUESTED = 'resubmission_requested',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum BankAccountStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface MerchantAddress {
  street: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface BankDetails {
  accountName: string;
  accountNumber: string; // stored encrypted
  bankName: string;
  bankCode?: string;
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
}

export interface MerchantSettings {
  notifyOnPayment?: boolean;
  notifyOnSettlement?: boolean;
  webhookRetryCount?: number;
  defaultCurrency?: string;
  autoSettlement?: boolean;
  [key: string]: unknown;
}

export interface KycDocument {
  type: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
}

// ─── Entity ───────────────────────────────────────────────────────────────────

@Entity('merchants')
@Index('IDX_MERCHANT_EMAIL', ['email'], { unique: true })
@Index('IDX_MERCHANT_KYC_STATUS', ['kycStatus'])
@Index('IDX_MERCHANT_STATUS', ['status'])
@Index('IDX_MERCHANT_CREATED_AT', ['createdAt'])
export class Merchant {
  // ── Primary key ────────────────────────────────────────────────────────────

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ── Business identifiers ───────────────────────────────────────────────────

  @Column({ name: 'name', type: 'varchar', length: 255 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @Column({
    name: 'business_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessName?: string;

  @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @Column({ name: 'phone', type: 'varchar', length: 50, nullable: true })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @Column({ name: 'password', type: 'varchar', length: 255 })
  @Exclude()
  password!: string;

  // ── Address ────────────────────────────────────────────────────────────────

  @Column({ name: 'address', type: 'jsonb', nullable: true })
  @IsOptional()
  address?: MerchantAddress;

  // ── Status ─────────────────────────────────────────────────────────────────

  @Column({
    name: 'status',
    type: 'enum',
    enum: MerchantStatus,
    default: MerchantStatus.PENDING,
  })
  @IsEnum(MerchantStatus)
  status!: MerchantStatus;

  // ── KYC ────────────────────────────────────────────────────────────────────

  @Column({
    name: 'kyc_status',
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.NOT_SUBMITTED,
  })
  @IsEnum(KycStatus)
  kycStatus!: KycStatus;

  @Column({ name: 'kyc_verified_at', type: 'timestamptz', nullable: true })
  kycVerifiedAt?: Date;

  @Column({ name: 'kyc_rejection_reason', type: 'text', nullable: true })
  kycRejectionReason?: string;

  @Column({ name: 'documents', type: 'jsonb', nullable: true })
  documents?: KycDocument[];

  // ── Bank details (stored AES-encrypted as ciphertext) ──────────────────────

  @Column({ name: 'bank_details_encrypted', type: 'text', nullable: true })
  @Exclude()
  bankDetailsEncrypted?: string;

  @Column({
    name: 'bank_account_status',
    type: 'enum',
    enum: BankAccountStatus,
    default: BankAccountStatus.PENDING,
  })
  @IsEnum(BankAccountStatus)
  bankAccountStatus!: BankAccountStatus;

  @Column({ name: 'bank_verified_at', type: 'timestamptz', nullable: true })
  bankVerifiedAt?: Date;

  // ── Settings & config ──────────────────────────────────────────────────────

  @Column({ name: 'settings', type: 'jsonb', nullable: true, default: {} })
  settings!: MerchantSettings;

  @Column({ name: 'settlement_config', type: 'jsonb', nullable: true })
  settlementConfig?: Record<string, unknown>;

  @Column({ name: 'fee_structure', type: 'jsonb', nullable: true })
  feeStructure?: Record<string, unknown>;

  @Column({
    name: 'supported_chains',
    type: 'text',
    array: true,
    nullable: true,
  })
  supportedChains?: string[];

  @Column({ name: 'flags', type: 'jsonb', nullable: true, default: [] })
  flags!: string[];

  // ── Email verification ─────────────────────────────────────────────────────

  @Column({ name: 'email_verification_token', type: 'varchar', nullable: true })
  @Exclude()
  emailVerificationToken?: string;

  // ── API quota ──────────────────────────────────────────────────────────────

  @Column({ name: 'api_quota_used', type: 'integer', default: 0 })
  apiQuotaUsed!: number;

  @Column({ name: 'api_quota_reset_at', type: 'timestamptz', nullable: true })
  apiQuotaResetAt?: Date;

  @Column({ name: 'ip_allowlist_enforced', type: 'boolean', default: false })
  ipAllowlistEnforced!: boolean;

  // ── Audit ──────────────────────────────────────────────────────────────────

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt?: Date;

  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt?: Date;

  // ── Relationships ──────────────────────────────────────────────────────────

  /** The admin/staff user who owns or manages this merchant account. */
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @OneToMany(() => Settlement, (s) => s.merchant)
  settlements!: Settlement[];

  @OneToMany(() => PaymentRequest, (p) => p.merchant)
  paymentRequests!: PaymentRequest[];

  @OneToMany(() => WebhookConfigurationEntity, (w) => w.merchant)
  webhookConfigurations!: WebhookConfigurationEntity[];

  @OneToMany(() => MerchantNote, (n) => n.merchant)
  notes!: MerchantNote[];

  @OneToMany(() => ApiKey, (k) => k.merchant)
  apiKeys!: ApiKey[];

  @OneToMany(() => MerchantDocument, (d) => d.merchant)
  merchantDocuments!: MerchantDocument[];

  @OneToMany(() => DocumentRequest, (r) => r.merchant)
  documentRequests!: DocumentRequest[];
}
