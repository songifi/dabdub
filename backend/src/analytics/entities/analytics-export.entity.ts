import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AnalyticsExportFormat {
  PDF = 'pdf',
}

export enum AnalyticsExportScope {
  MERCHANT = 'merchant',
  ADMIN = 'admin',
}

export enum AnalyticsExportStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity('analytics_exports')
export class AnalyticsExport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AnalyticsExportFormat })
  format: AnalyticsExportFormat;

  @Column({ type: 'enum', enum: AnalyticsExportScope })
  scope: AnalyticsExportScope;

  @Column({ type: 'enum', enum: AnalyticsExportStatus, default: AnalyticsExportStatus.QUEUED })
  status: AnalyticsExportStatus;

  @Column()
  requestedByMerchantId: string;

  @Column({ nullable: true })
  merchantId: string | null;

  @Column()
  recipientEmail: string;

  @Column()
  merchantBusinessName: string;

  @Column({ type: 'varchar', length: 16 })
  period: 'daily' | 'monthly';

  @Column({ type: 'varchar', length: 10, nullable: true })
  dateFrom: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  dateTo: string | null;

  @Column()
  deliveryBaseUrl: string;

  @Column({ nullable: true })
  fileName: string | null;

  @Column({ type: 'bytea', nullable: true })
  fileData: Buffer | null;

  @Column({ nullable: true, unique: true })
  downloadToken: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
