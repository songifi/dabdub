import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';
import { Merchant } from '../../database/entities/merchant.entity';
import { DocumentType, DocumentStatus } from '../enums/merchant-document.enums';

@Entity('merchant_documents')
@Index(['merchantId'])
@Index(['status'])
@Index(['documentType'])
@Index(['documentExpiresAt'])
export class MerchantDocument extends BaseEntity {
  @Column({ name: 'merchant_id' })
  merchantId: string;

  @Column({
    name: 'document_type',
    type: 'enum',
    enum: DocumentType,
  })
  documentType: DocumentType;

  @Column({ name: 'original_filename' })
  originalFilename: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'file_size_bytes', type: 'bigint' })
  fileSizeBytes: string;

  @Column({ name: 's3_key' })
  s3Key: string; // encrypted reference

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.UPLOADED,
  })
  status: DocumentStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'reviewed_by_id', nullable: true })
  reviewedById: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'document_expires_at', type: 'timestamptz', nullable: true })
  documentExpiresAt: Date | null;

  @Column({ name: 'expiry_alert_sent_at', type: 'timestamptz', nullable: true })
  expiryAlertSentAt: Date | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => Merchant, (merchant) => merchant.merchantDocuments)
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;
}
