import { IsNumber, IsPositive, IsString, IsOptional, IsEmail, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 50.0 })
  @IsNumber()
  @IsPositive()
  amountUsd: number;

  @ApiPropertyOptional({ example: 'Payment for order #123' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'customer@example.com' })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ example: 30, description: 'Expiry in minutes (default 30)' })
  @IsOptional()
  @IsNumber()
  expiryMinutes?: number;
}
