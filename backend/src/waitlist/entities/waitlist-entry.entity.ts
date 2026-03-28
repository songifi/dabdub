import { Entity, Column, Index, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('waitlist_entries')
@Index(['ipAddress'])
export class WaitlistEntry extends BaseEntity {
  @Column({ unique: true, length: 255 })
  email!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'referral_code', unique: true, length: 16 })
  referralCode!: string;

  @Column({ name: 'referred_by_code', length: 16, nullable: true, default: null })
  referredByCode!: string | null;

  @Column({ default: 100 })
  points!: number;

  @Column({ name: 'ip_address', length: 45 })
  ipAddress!: string;

  @Column({ length: 255, nullable: true, default: null })
  fingerprint!: string | null;

  @Column({ name: 'is_fraud_flagged', default: false })
  isFraudFlagged!: boolean;

  // Override BaseEntity's createdAt name to match spec
  @CreateDateColumn({ name: 'joined_at' })
  joinedAt!: Date;
}
