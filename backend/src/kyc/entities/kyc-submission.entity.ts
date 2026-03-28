import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { TierName } from '../../tier-config/entities/tier-config.entity';

export enum KycSubmissionStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum KycDocumentType {
  ID = 'id',
  PASSPORT = 'passport',
  DL = 'dl',
}

@Entity('kyc_submissions')
@Index(['userId'])
@Index(['status'])
export class KycSubmission extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'target_tier', type: 'enum', enum: [TierName.GOLD, TierName.BLACK] })
  targetTier!: TierName.GOLD | TierName.BLACK;

  @Column({
    type: 'enum',
    enum: KycSubmissionStatus,
    default: KycSubmissionStatus.PENDING,
  })
  status!: KycSubmissionStatus;

  @Column({ name: 'bvn_last4', length: 4 })
  bvnLast4!: string;

  @Column({ name: 'nin_last4', length: 4 })
  ninLast4!: string;

  @Column({ name: 'document_type', type: 'enum', enum: KycDocumentType })
  documentType!: KycDocumentType;

  @Column({ name: 'document_front_key' })
  documentFrontKey!: string;

  @Column({ name: 'document_back_key', nullable: true, default: null })
  documentBackKey!: string | null;

  @Column({ name: 'selfie_key' })
  selfieKey!: string;

  @Column({ name: 'review_note', type: 'text', nullable: true, default: null })
  reviewNote!: string | null;

  @Column({ name: 'reviewed_by', nullable: true, default: null })
  reviewedBy!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true, default: null })
  reviewedAt!: Date | null;
}
