import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BulkPaymentRow } from './bulk-payment-row.entity';

export enum BulkPaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  PARTIAL_FAILURE = 'partial_failure',
}

@Entity('bulk_payments')
export class BulkPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  initiatedBy: string;

  @Column('varchar', { length: 100 })
  label: string;

  @Column('varchar')
  csvKey: string;

  @Column('int')
  totalRows: number;

  @Column('int', { default: 0 })
  successCount: number;

  @Column('int', { default: 0 })
  failureCount: number;

  @Column('varchar')
  totalAmountUsdc: string;

  @Column('enum', { enum: BulkPaymentStatus, default: BulkPaymentStatus.PENDING })
  status: BulkPaymentStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column('timestamp', { nullable: true })
  completedAt: Date | null;

  @OneToMany(() => BulkPaymentRow, (row) => row.bulkPayment, { cascade: true })
  rows: BulkPaymentRow[];
}