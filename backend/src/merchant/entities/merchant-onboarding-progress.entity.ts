import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Merchant } from '../../database/entities/merchant.entity';

export type OnboardingStepKey =
  | 'ACCOUNT_CREATED'
  | 'EMAIL_VERIFIED'
  | 'BUSINESS_PROFILE_COMPLETE'
  | 'KYC_SUBMITTED'
  | 'KYC_APPROVED'
  | 'BANK_ACCOUNT_LINKED'
  | 'API_KEY_GENERATED'
  | 'FIRST_TRANSACTION'
  | 'FIRST_SETTLEMENT';

export type OnboardingStepStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'BLOCKED';

export interface OnboardingStep {
  key: OnboardingStepKey;
  status: OnboardingStepStatus;
  completedAt: Date | null;
  blockedReason: string | null;
}

@Entity('merchant_onboarding_progress')
@Index(['merchantId'], { unique: true })
@Index(['isStuck', 'lastProgressAt'])
@Index(['completionPercentage'])
export class MerchantOnboardingProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  merchantId: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'merchantId' })
  merchant: Merchant;

  @Column({ type: 'jsonb' })
  steps: OnboardingStep[];

  @Column({ type: 'int', default: 0 })
  completedStepCount: number;

  @Column({ type: 'int', default: 9 })
  totalStepCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  completionPercentage: string;

  @Column({ type: 'boolean', default: false })
  isStuck: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastProgressAt: Date | null;

  @Column({ type: 'int', nullable: true })
  daysInCurrentStep: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
