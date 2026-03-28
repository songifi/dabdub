import { ApiProperty } from '@nestjs/swagger';
import { User, KycStatus } from '../entities/user.entity';
import { TierName } from '../../tier-config/entities/tier-config.entity';
import { Role } from '../../rbac/rbac.types';

/**
 * DTO for user profile responses
 * Excludes: passwordHash, isAdmin, isTreasury
 * Includes: all public user information
 */
export class UserResponseDto {
  @ApiProperty({
    description: 'User UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Email address',
    example: 'user@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'Unique username',
    example: 'johndoe',
  })
  username!: string;

  @ApiProperty({
    description: 'Display name',
    example: 'John Doe',
    nullable: true,
  })
  displayName!: string | null;

  @ApiProperty({
    description: 'Phone number in E.164 format',
    example: '+234801234567',
    nullable: true,
  })
  phone!: string | null;

  @ApiProperty({
    description: 'User tier (Silver, Gold, Black)',
    enum: TierName,
    example: TierName.SILVER,
  })
  tier!: TierName;

  @ApiProperty({
    description: 'KYC verification status',
    enum: KycStatus,
    example: KycStatus.NONE,
  })
  kycStatus!: KycStatus;

  @ApiProperty({
    description: 'Whether user is a merchant',
    example: false,
  })
  isMerchant!: boolean;

  @ApiProperty({
    description: 'User role',
    enum: Role,
    example: Role.User,
  })
  role!: Role;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2026-03-26T10:00:00Z',
  })
  createdAt!: Date;

  /**
   * Convert User entity to response DTO
   */
  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.username = user.username;
    dto.displayName = user.displayName;
    dto.phone = user.phone;
    dto.tier = user.tier;
    dto.kycStatus = user.kycStatus;
    dto.isMerchant = user.isMerchant;
    dto.role = user.role;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
