import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum LoginStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  BLOCKED = 'blocked',
}

export enum LoginFailureReason {
  INVALID_PASSWORD = 'invalid_password',
  INVALID_EMAIL = 'invalid_email',
  ACCOUNT_DISABLED = 'account_disabled',
  TOO_MANY_ATTEMPTS = 'too_many_attempts',
  UNKNOWN = 'unknown',
}

/**
 * LoginHistory
 *
 * Records every login attempt (success or failure).
 * Used to detect suspicious activity and display login history to users.
 */
@Entity('login_history')
@Index('IDX_login_history_user_created_at', { synchronize: false }, ['userId', 'createdAt'])
export class LoginHistory extends BaseEntity {
  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ nullable: true })
  ipAddress!: string | null;

  @Column({ nullable: true })
  userAgent!: string | null;

  @Column({ nullable: true, comment: 'Reverse geocoded location from IP address' })
  location!: string | null;

  @Column({
    type: 'enum',
    enum: LoginStatus,
    default: LoginStatus.SUCCESS,
  })
  status!: LoginStatus;

  @Column({
    type: 'enum',
    enum: LoginFailureReason,
    nullable: true,
  })
  failureReason!: LoginFailureReason | null;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
