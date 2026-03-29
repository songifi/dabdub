import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum VerificationType {
  BVN = 'bvn',
  NIN = 'nin',
  BANK = 'bank',
}

export enum VerificationStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  PENDING = 'pending',
}

@Entity('kyc_verification_results')
@Index(['userId'])
@Index(['submissionId'])
export class VerificationResult extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'submission_id' })
  submissionId!: string;

  @Column({ name: 'verification_type', type: 'enum', enum: VerificationType })
  verificationType!: VerificationType;

  @Column({ type: 'enum', enum: VerificationStatus, default: VerificationStatus.PENDING })
  status!: VerificationStatus;

  @Column({ name: 'provider_ref', nullable: true, default: null })
  providerRef!: string | null;

  /** Last 4 digits only — never store full BVN/NIN */
  @Column({ name: 'masked_input', length: 4 })
  maskedInput!: string;

  @Column({ name: 'verified_name', nullable: true, default: null })
  verifiedName!: string | null;

  /** Encrypted at rest in production via transparent column encryption or DB-level encryption */
  @Column({ name: 'raw_response', type: 'jsonb', nullable: true, default: null })
  rawResponse!: Record<string, unknown> | null;
}
