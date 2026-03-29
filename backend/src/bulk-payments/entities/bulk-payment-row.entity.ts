import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BulkPayment } from './bulk-payment.entity';

export enum BulkPaymentRowStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity('bulk_payment_rows')
export class BulkPaymentRow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  bulkPaymentId: string;

  @ManyToOne(() => BulkPayment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bulk_payment_id' })
  bulkPayment: BulkPayment;

  @Column('int')
  rowNumber: number;

  @Column('varchar')
  toUsername: string;

  @Column('varchar')
  amountUsdc: string;

  @Column('varchar', { nullable: true })
  note: string | null;

  @Column('enum', { enum: BulkPaymentRowStatus, default: BulkPaymentRowStatus.PENDING })
  status: BulkPaymentRowStatus;

  @Column('varchar', { nullable: true })
  failureReason: string | null;

  @Column('varchar', { nullable: true })
  txId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column('timestamp', { nullable: true })
  processedAt: Date | null;
}