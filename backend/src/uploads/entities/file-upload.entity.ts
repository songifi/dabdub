import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum UploadPurpose {
  KYC = 'kyc',
  MERCHANT_LOGO = 'merchant_logo',
  REPORT = 'report',
}

@Entity('file_uploads')
export class FileUpload extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Index({ unique: true })
  @Column({ unique: true })
  key!: string;

  @Column()
  bucket!: string;

  @Column({ name: 'mime_type' })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes!: number;

  @Column({ type: 'enum', enum: UploadPurpose })
  purpose!: UploadPurpose;

  @Column({ name: 'is_confirmed', default: false })
  isConfirmed!: boolean;
}
