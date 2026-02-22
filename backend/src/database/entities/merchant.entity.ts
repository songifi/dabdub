import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Settlement } from '../../settlement/entities/settlement.entity';
import { PaymentRequest } from './payment-request.entity';
import { WebhookConfigurationEntity } from './webhook-configuration.entity';
import { MerchantNote } from '../../merchant/entities/merchant-note.entity';
import { ApiKey } from '../../api-key/entities/api-key.entity';
import { MerchantDocument } from '../../merchant/entities/merchant-document.entity';
import { DocumentRequest } from '../../merchant/entities/document-request.entity';



/**
 * Merchant account status
 */
export enum MerchantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  CLOSED = 'closed',
  TERMINATED = 'terminated',
}

export enum KycStatus {
  PENDING = 'pending',
  RESUBMISSION_REQUESTED = 'resubmission_requested',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NOT_SUBMITTED = 'not_submitted',
  IN_REVIEW = 'in_review',
}

export enum BankAccountStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

@Entity('merchants')
@Index(['email'], { unique: true })
@Index(['status'])
@Index(['kycStatus'])
@Index(['kycStatus'])
@Index(['createdAt'])
export class Merchant {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({
    name: 'business_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  businessName!: string;

  @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'password', type: 'varchar', length: 255 })
  @Exclude()
  password!: string;

  @Column({
    type: 'enum',
    enum: MerchantStatus,
    default: MerchantStatus.ACTIVE,
  })
  status!: MerchantStatus;

  @Column({
    name: 'kyc_status',
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.NOT_SUBMITTED,
  })
  kycStatus!: KycStatus;

  @Column({ name: 'bank_details', type: 'jsonb', nullable: true })
  @Exclude()
  bankDetails!: Record<string, any>;

  @Column({ name: 'documents', type: 'jsonb', nullable: true })
  documents!: Record<string, any>;

  @Column({ name: 'settings', type: 'jsonb', nullable: true })
  settings!: Record<string, any>;

  @Column({ name: 'settlement_config', type: 'jsonb', nullable: true })
  settlementConfig!: Record<string, any>;

  @Column({ name: 'fee_structure', type: 'jsonb', nullable: true })
  feeStructure!: Record<string, any>;

  @Column({ name: 'supported_chains', type: 'text', array: true, nullable: true })
  supportedChains!: string[];

  @Column({ name: 'flags', type: 'jsonb', nullable: true, default: [] })
  flags!: string[];


  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt?: Date;

  @Column({ name: 'suspended_at', type: 'timestamp', nullable: true })
  suspendedAt?: Date;

  @Column({ name: 'kyc_verified_at', type: 'timestamp', nullable: true })
  kycVerifiedAt?: Date;

  @Column({ name: 'bank_verified_at', type: 'timestamp', nullable: true })
  bankVerifiedAt?: Date;

  @Column({ name: 'email_verification_token', type: 'varchar', nullable: true })
  emailVerificationToken?: string;

  @Column({ name: 'bank_account_status', type: 'varchar', default: 'pending' })
  bankAccountStatus!: string;

  @Column({ name: 'api_quota_used', type: 'integer', default: 0 })
  apiQuotaUsed!: number;

  @Column({ name: 'api_quota_reset_at', type: 'timestamp', nullable: true })
  apiQuotaResetAt?: Date;

  @Column({ name: 'ip_allowlist_enforced', type: 'boolean', default: false })
  ipAllowlistEnforced!: boolean;

  // Relationships
  @OneToMany(() => Settlement, (settlement) => settlement.merchant)
  settlements!: Settlement[];

  @OneToMany(() => PaymentRequest, (paymentRequest) => paymentRequest.merchant)
  paymentRequests!: PaymentRequest[];

  @OneToMany(
    () => WebhookConfigurationEntity,
    (webhookConfig) => webhookConfig.merchant,
  )
  webhookConfigurations!: WebhookConfigurationEntity[];

  @OneToMany(
    () => require('../../kyc/entities/kyc-verification.entity').KycVerification,
    (kycVerification: any) => kycVerification.merchant,
  )
  kycVerifications!: any[];

  @OneToMany(() => MerchantNote, (note) => note.merchant)
  notes!: MerchantNote[];

  @OneToMany(() => ApiKey, (apiKey) => apiKey.merchant)
  apiKeys!: ApiKey[];

  @OneToMany(() => MerchantDocument, (document) => document.merchant)
  merchantDocuments!: MerchantDocument[];

  @OneToMany(() => DocumentRequest, (request) => request.merchant)
  documentRequests!: DocumentRequest[];
}



/**
 * KYC Document interface
 */
export interface KycDocument {
  type: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
}

/**
 * Notification preferences interface
 */
export interface NotificationPreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  paymentReceived: boolean;
  settlementCompleted: boolean;
  kycStatusUpdate: boolean;
  securityAlerts: boolean;
  marketingEmails: boolean;
}
