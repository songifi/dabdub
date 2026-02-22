import { Matches, IsString, MinLength, IsBoolean, IsEnum, IsOptional, IsDateString } from 'class-validator';

const CIDR_REGEX = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/;
import { BlockReason } from '../enums';

export class AddIpAllowlistDto {
  @Matches(CIDR_REGEX, { message: 'Invalid CIDR format' })
  cidr: string;

  @IsString()
  @MinLength(3)
  label: string;
}

export class ToggleEnforcementDto {
  @IsBoolean()
  enabled: boolean;
}

export class BlockIpDto {
  @Matches(CIDR_REGEX, { message: 'Invalid CIDR format' })
  cidr: string;

  @IsEnum(BlockReason)
  reason: BlockReason;

  @IsString()
  @MinLength(20)
  note: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string; // null = permanent
}
