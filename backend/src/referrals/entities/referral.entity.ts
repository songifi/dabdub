import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ReferralStatus {
  PENDING = 'pending',
  CONVERTED = 'converted',
  REWARDED = 'rewarded',
  EXPIRED = 'expired',
}

@Entity('referrals')
@Index(['referrerId'])
@Index(['referredUserId'], { unique: true })
@Index(['status'])
@Index(['code'])
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  referrerId!: string;

  @Column()
  referredUserId!: string;

  @Column()
  code!: string;

  @Column({
    type: 'enum',
    enum: ReferralStatus,
    default: ReferralStatus.PENDING,
  })
  status!: ReferralStatus;

  @Column({ type: 'varchar', default: '0.00' })
  rewardAmountUsdc!: string;

  @Column({ type: 'timestamp', nullable: true })
  convertedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  rewardedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
