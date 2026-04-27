import {
  IsNumber,
  IsPositive,
  IsString,
  IsOptional,
  IsEmail,
  IsObject,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsNotEmpty,
  MinLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BatchPaymentItemDto {
  @ApiProperty({ example: 50.0, description: 'Amount in USD — must be greater than 0' })
  @IsNumber()
  @IsPositive()
  amountUsd: number;

  @ApiProperty({ example: 'Order #123', description: 'Non-empty memo for this payment' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @Transform(({ value }) => value?.trim())
  memo: string;

  @ApiPropertyOptional({ example: 'customer@example.com' })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.trim())
  customerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ example: 30, description: 'Expiry in minutes (default 30)' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  expiryMinutes?: number;
}

export class BatchCreatePaymentDto {
  @ApiProperty({
    type: [BatchPaymentItemDto],
    description: 'Between 1 and 20 payment requests to create atomically',
    minItems: 1,
    maxItems: 20,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BatchPaymentItemDto)
  payments: BatchPaymentItemDto[];
}

export class BatchPaymentResultDto {
  @ApiProperty({ description: 'IDs of all created payments in order' })
  paymentIds: string[];

  @ApiProperty({ description: 'Total number of payments created' })
  count: number;
}
