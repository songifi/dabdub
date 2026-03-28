import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

/**
 * TrustedDevice
 *
 * Records devices that users have authenticated from.
 * Users can view and revoke trusted devices.
 */
@Entity('trusted_devices')
export class TrustedDevice extends BaseEntity {
  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ unique: true })
  deviceHash!: string;

  @Column()
  deviceName!: string;

  @Column({ nullable: true })
  ipAddress!: string | null;

  @Column({ nullable: true })
  userAgent!: string | null;

  @Column({ nullable: true })
  location!: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  lastSeenAt!: Date | null;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
