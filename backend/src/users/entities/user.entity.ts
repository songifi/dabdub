import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Role } from '../../rbac/rbac.types';
import { TierName } from '../../tier-config/entities/tier-config.entity';

/** @deprecated Use {@link Role} from `rbac.types` (matches DB enum). */
export enum UserRole {
  USER = 'user',
  MERCHANT = 'merchant',
  ADMIN = 'admin',
  SUPERADMIN = 'super_admin',
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

  @Column({ name: 'email_verified', default: false })
  emailVerified!: boolean;

  @Column({ unique: true, length: 20 })
  @Index()
  username!: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash!: string;

  @Column({ name: 'pin_hash', length: 255, nullable: true, default: null })
  pinHash!: string | null;

  @Column({ unique: true, length: 20, nullable: true, default: null })
  phone!: string | null;

  @Column({ name: 'phone_verified', default: false })
  phoneVerified!: boolean;

  @Column({ name: 'display_name', length: 100, nullable: true, default: null })
  displayName!: string | null;

  @Column({ length: 160, nullable: true, default: null })
  bio!: string | null;

  @Column({ name: 'avatar_key', length: 255, nullable: true, default: null })
  avatarKey!: string | null;

  @Column({ name: 'twitter_handle', length: 50, nullable: true, default: null })
  twitterHandle!: string | null;

  @Column({ name: 'instagram_handle', length: 50, nullable: true, default: null })
  instagramHandle!: string | null;

  @Column({
    type: 'enum',
    enum: TierName,
    default: TierName.SILVER,
  })
  tier!: TierName;

  /**
   * Target tier from an in-app upgrade while KYC is not yet approved.
   * Cleared after automatic or manual tier application.
   */
  @Column({
    name: 'pending_tier_upgrade',
    type: 'varchar',
    length: 10,
    nullable: true,
    default: null,
  })
  pendingTierUpgrade!: TierName | null;

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

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'passkey_id', length: 255, nullable: true, default: null })
  passkeyId!: string | null;
}
