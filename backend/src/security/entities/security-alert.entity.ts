import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum SecurityAlertType {
  NEW_DEVICE = 'new_device',
  NEW_COUNTRY = 'new_country',
  PIN_ATTEMPTS = 'pin_attempts',
  LARGE_WITHDRAWAL = 'large_withdrawal',
}

/**
 * SecurityAlert
 *
 * Auto-generated alerts for suspicious or notable account activity.
 * Users can view and dismiss alerts from the security dashboard.
 */
@Entity('security_alerts')
@Index('IDX_security_alerts_user_created_at', { synchronize: false }, ['userId', 'createdAt'])
@Index('IDX_security_alerts_user_unread', { synchronize: false }, ['userId', 'isRead'])
export class SecurityAlert extends BaseEntity {
  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'enum',
    enum: SecurityAlertType,
  })
  type!: SecurityAlertType;

  @Column()
  message!: string;

  @Column({ name: 'is_read', default: false })
  isRead!: boolean;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
