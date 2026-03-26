import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { TierName } from '../../tier-config/entities/tier-config.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true, length: 255 })
  email!: string;

  @Column({ unique: true, length: 50 })
  username!: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash!: string;

  @Column({ name: 'display_name', length: 100, nullable: true, default: null })
  displayName!: string | null;

  @Column({
    type: 'enum',
    enum: TierName,
    default: TierName.SILVER,
  })
  tier!: TierName;

  /** True only for the built-in system admin account. */
  @Column({ name: 'is_admin', default: false })
  isAdmin!: boolean;

  /** True only for the fee-treasury wallet user (system account). */
  @Column({ name: 'is_treasury', default: false })
  isTreasury!: boolean;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
