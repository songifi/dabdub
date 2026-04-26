import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { Payment } from '../../payments/entities/payment.entity';

export enum SettlementStatus {
  PENDING = 'pending',
  PENDING_APPROVAL = 'pending_approval',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('settlements')
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Merchant, (merchant) => merchant.settlements)
  @JoinColumn({ name: 'merchantId' })
  merchant: Merchant;

  @Column()
  merchantId: string;

  @OneToMany(() => Payment, (payment) => payment.settlement)
  payments: Payment[];

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  totalAmountUsd: number;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  feeAmountUsd: number;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  netAmountUsd: number;

  @Column({ nullable: true })
  fiatCurrency: string;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  fiatAmount: number;

  @Column({ type: 'enum', enum: SettlementStatus, default: SettlementStatus.PENDING })
  status: SettlementStatus;

  @Column({ nullable: true })
  partnerReference: string;

  @Column({ nullable: true })
  bankReference: string;

  @Column({ nullable: true })
  failureReason: string;

  @Column({ default: false })
  requiresApproval: boolean;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ nullable: true })
  approvedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
