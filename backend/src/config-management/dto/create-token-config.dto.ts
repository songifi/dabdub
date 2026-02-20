import { IsString, IsInt, IsBoolean, IsUrl, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTokenConfigDto {
  @ApiProperty({ description: 'Chain ID this token belongs to' })
  @IsString()
  chainId!: string;

  @ApiProperty({ description: 'Token contract address' })
  @IsString()
  tokenAddress!: string;

  @ApiProperty({ description: 'Token symbol (e.g., "USDC", "USDT")' })
  @IsString()
  symbol!: string;

  @ApiProperty({ description: 'Token full name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Token decimals' })
  @IsInt()
  @Min(0)
  @Max(18)
  decimals!: number;

  @ApiPropertyOptional({ description: 'Token logo URL' })
  @IsUrl()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Whether token is enabled', default: true })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Whether token is a stablecoin', default: false })
  @IsBoolean()
  @IsOptional()
  isStablecoin?: boolean;

  @ApiPropertyOptional({ description: 'Display priority (higher = shown first)', default: 0 })
  @IsInt()
  @IsOptional()
  priority?: number;
}
