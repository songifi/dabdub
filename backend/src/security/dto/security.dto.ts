import { IsBoolean, IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { KycStatus } from '../../users/entities/user.entity';
import { SecurityAlertType } from '../entities/security-alert.entity';

export class SecurityAlertDto {
  @IsString()
  id!: string;

  @IsEnum(SecurityAlertType)
  type!: SecurityAlertType;

  @IsString()
  message!: string;

  @IsBoolean()
  isRead!: boolean;

  @IsString()
  createdAt!: string;
}

export class TrustedDeviceDto {
  @IsString()
  id!: string;

  @IsString()
  deviceName!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsString()
  lastSeenAt!: string;

  @IsString()
  createdAt!: string;
}

export class LoginHistoryDto {
  @IsString()
  id!: string;

  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsString()
  status!: string;

  @IsString()
  createdAt!: string;
}

export class SecurityOverviewDto {
  @IsNumber()
  securityScore!: number;

  @IsBoolean()
  emailVerified!: boolean;

  @IsBoolean()
  phoneVerified!: boolean;

  @IsBoolean()
  hasPin!: boolean;

  @IsBoolean()
  hasPasskey!: boolean;

  @IsEnum(KycStatus)
  kycStatus!: KycStatus;

  @IsNumber()
  activeSessions!: number;

  @IsNumber()
  trustedDevices!: number;

  @IsOptional()
  @IsString()
  lastLoginAt?: string;

  @IsOptional()
  @IsString()
  lastLoginIp?: string;

  @IsOptional()
  recentAlerts?: SecurityAlertDto[];
}

export class PaginatedLoginHistoryDto {
  data!: LoginHistoryDto[];
  limit!: number;
  total!: number;
  page!: number;
  hasMore!: boolean;
}

export class PaginatedSecurityAlertsDto {
  data!: SecurityAlertDto[];
  limit!: number;
  total!: number;
  page!: number;
  hasMore!: boolean;
}

export class PaginatedTrustedDevicesDto {
  data!: TrustedDeviceDto[];
  limit!: number;
  total!: number;
  page!: number;
  hasMore!: boolean;
}
