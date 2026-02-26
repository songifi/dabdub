import {
  IsNumber,
  IsString,
  IsOptional,
  IsNotEmpty,
  IsPositive,
  Min,
  Max,
  IsObject,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SUPPORTED_CHAINS,
  type SupportedChain,
} from '../constants/supported-chains.constant';

const DEFAULT_EXPIRES_MINUTES = 30;
const MAX_EXPIRES_MINUTES = 24 * 60; // 24 hours

export class CreatePaymentRequestDto {
  @ApiProperty({
    description: 'Fiat amount to convert to USDC',
    example: 100.5,
  })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({
    description: 'Fiat currency code (ISO 4217)',
    example: 'USD',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  currency!: string;

  @ApiProperty({
    description: 'Blockchain chain for deposit',
    enum: SUPPORTED_CHAINS,
    example: 'polygon',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(SUPPORTED_CHAINS as unknown as string[], {
    message: `chain must be one of: ${SUPPORTED_CHAINS.join(', ')}`,
  })
  chain!: SupportedChain;

  @ApiPropertyOptional({
    description: 'Optional metadata attached to the payment request',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Expiration in minutes (default 30, max 1440)',
    default: DEFAULT_EXPIRES_MINUTES,
    minimum: 1,
    maximum: MAX_EXPIRES_MINUTES,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_EXPIRES_MINUTES)
  expiresInMinutes?: number;
}

export { DEFAULT_EXPIRES_MINUTES, MAX_EXPIRES_MINUTES };
