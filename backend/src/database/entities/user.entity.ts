import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { SessionEntity } from './session.entity';

export enum UserRole {
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  MERCHANT = 'merchant',
  USER = 'user',
  SUPPORT_ADMIN = 'support_admin',
}

/** Permissions that SUPPORT_ADMIN does not have (finance-sensitive). */
export const RESTRICTED_FOR_SUPPORT_ADMIN = new Set(['analytics:revenue']);

/** Role-to-permissions map for admin users. */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: ['analytics:revenue', 'analytics:read', 'merchants:kyc:review'],
  [UserRole.SUPER_ADMIN]: ['analytics:revenue', 'analytics:read', 'admin:queues', 'merchants:kyc:review'],
  [UserRole.SUPPORT_ADMIN]: ['analytics:read', 'merchants:kyc:review'],
  [UserRole.MERCHANT]: [],
  [UserRole.USER]: [],
};

@Entity('users')
export class UserEntity {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  @Exclude()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true })
  @Exclude()
  emailVerificationToken?: string;

  @Column({ nullable: true })
  @Exclude()
  emailVerificationTokenExpiry?: Date;

  @Column({ default: false })
  twoFactorEnabled: boolean;

  @Column({ nullable: true })
  @Exclude()
  twoFactorSecret?: string;

  @Column({ default: 0 })
  loginAttempts: number;

  @Column({ nullable: true })
  lastFailedLoginAt?: Date;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @Column({ nullable: true })
  @Exclude()
  passwordResetToken?: string;

  @Column({ nullable: true })
  @Exclude()
  passwordResetTokenExpiry?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => SessionEntity, (session) => session.user, {
    cascade: true,
  })
  sessions: SessionEntity[];
}
