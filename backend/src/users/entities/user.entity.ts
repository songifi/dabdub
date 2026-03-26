import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Role } from '../../rbac/rbac.types';
import { TierName } from '../../tier-config/entities/tier-config.entity';

export enum UserRole {
  USER = 'user',
  MERCHANT = 'merchant',
  ADMIN = 'admin',
  SUPERADMIN = 'superadmin',
}

export enum KycStatus {
  NONE = 'none',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true, length: 255 })
  email!: string;

  @Column({ unique: true, length: 50 })
  username!: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash!: string;

  @Column({ unique: true, length: 20, nullable: true, default: null })
  phone!: string | null;

  @Column({ name: 'display_name', length: 100, nullable: true, default: null })
  displayName!: string | null;

  @Column({
    type: 'enum',
    enum: TierName,
    default: TierName.SILVER,
  })
  tier!: TierName;

  @Column({
    name: 'kyc_status',
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.NONE,
  })
  kycStatus!: KycStatus;

  /** True only for the built-in system admin account. */
  @Column({ name: 'is_admin', default: false })
  isAdmin!: boolean;

  /** True only for the fee-treasury wallet user (system account). */
  @Column({ name: 'is_treasury', default: false })
  isTreasury!: boolean;

  @Column({ type: 'enum', enum: Role, default: Role.User })
  role!: Role;
  @Column({ name: 'is_merchant', default: false })
  isMerchant!: boolean;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
