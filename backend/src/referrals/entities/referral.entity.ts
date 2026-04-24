import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

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
@Index(['code'], { unique: true })
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'referrer_id' })
  referrerId!: string;

  @Column({ name: 'referred_user_id' })
  referredUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrer_id' })
  referrer!: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referred_user_id' })
  referredUser!: User;

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
