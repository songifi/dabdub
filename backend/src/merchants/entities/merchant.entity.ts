import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude, Transform } from 'class-transformer';
import { Payment } from '../../payments/entities/payment.entity';
import { Settlement } from '../../settlements/entities/settlement.entity';
import { Webhook } from '../../webhooks/entities/webhook.entity';

export enum MerchantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

export enum MerchantRole {
  ADMIN = 'admin',
  MERCHANT = 'merchant',
  SUPERADMIN = 'superadmin',
}

@Entity('merchants')
export class Merchant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column()
  passwordHash: string;

  @Column()
  businessName: string;

  @Column({ nullable: true })
  businessType: string;

  @Column({ nullable: true })
  country: string;

  @Transform(({ value }) => (value ? `****${String(value).slice(-4)}` : null))
  @Column({ nullable: true })
  bankAccountNumber: string;

  @Column({ nullable: true })
  bankCode: string;

  @Column({ nullable: true })
  bankName: string;

  @Column({ type: 'enum', enum: MerchantStatus, default: MerchantStatus.PENDING })
  status: MerchantStatus;

  @Column({ type: 'enum', enum: MerchantRole, default: MerchantRole.MERCHANT })
  role: MerchantRole;

  @Column({ nullable: true })
  apiKey: string;

  @Exclude()
  @Column({ nullable: true })
  apiKeyHash: string;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  totalVolumeUsd: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0.015 })
  feeRate: number;

  /** Per-merchant custom fee rate override. Null means use global default. */
  @Column({
    name: 'custom_fee_rate',
    type: 'numeric',
    precision: 7,
    scale: 6,
    nullable: true,
    default: null,
  })
  customFeeRate: string | null;

  @Column({ default: false })
  sandboxMode: boolean;

  @Column({ nullable: true })
  totpSecret: string | null;

  @Column({ default: false })
  totpEnabled: boolean;

  @Column({ nullable: true, type: 'text' })
  allowedIps: string | null;

  @Column({ default: true })
  paymentConfirmedEmailEnabled: boolean;

  @OneToMany(() => Payment, (payment) => payment.merchant)
  payments: Payment[];

  @OneToMany(() => Settlement, (settlement) => settlement.merchant)
  settlements: Settlement[];

  @OneToMany(() => Webhook, (webhook) => webhook.merchant)
  webhooks: Webhook[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
