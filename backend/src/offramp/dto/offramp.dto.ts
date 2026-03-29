import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OffRamp, OffRampStatus } from '../entities/off-ramp.entity';

// ── Request DTOs ─────────────────────────────────────────────────────────────

export class PreviewOffRampDto {
  @ApiProperty({ description: 'Amount in USDC to convert', example: 10 })
  @IsNumber()
  @Min(1)
  amountUsdc: number;
}

export class ExecuteOffRampDto {
  @ApiProperty({ description: 'Amount in USDC to convert', example: 10 })
  @IsNumber()
  @Min(1)
  amountUsdc: number;

  @ApiProperty({ description: 'Bank account ID to receive NGN' })
  @IsUUID()
  bankAccountId: string;

  @ApiProperty({ description: '4-digit transaction PIN' })
  @IsString()
  @IsNotEmpty()
  pin: string;

  @ApiProperty({ description: 'Rate seen at preview time (for rate-lock check)', example: '1600' })
  @IsString()
  @IsNotEmpty()
  previewRate: string;
}

export class OffRampHistoryQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  limit?: number;
}

export class AdminOffRampQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: OffRampStatus })
  @IsOptional()
  @IsEnum(OffRampStatus)
  status?: OffRampStatus;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Start of date range (ISO 8601)', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End of date range (ISO 8601)', example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  limit?: number;
}

// ── Response DTOs ────────────────────────────────────────────────────────────

export class OffRampPreviewResponseDto {
  @ApiProperty() amountUsdc: number;
  @ApiProperty() rate: string;
  @ApiProperty() spreadPercent: number;
  @ApiProperty() feeUsdc: string;
  @ApiProperty() netAmountUsdc: string;
  @ApiProperty() ngnAmount: string;
  @ApiProperty()
  bankAccount: {
    id: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null;
}

export class OffRampResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() reference: string;
  @ApiProperty() amountUsdc: string;
  @ApiProperty() feeUsdc: string;
  @ApiProperty() netAmountUsdc: string;
  @ApiProperty() rate: string;
  @ApiProperty() spreadPercent: string;
  @ApiProperty() ngnAmount: string;
  @ApiProperty() bankAccountNumber: string;
  @ApiProperty() bankName: string;
  @ApiProperty() accountName: string;
  @ApiProperty({ enum: OffRampStatus }) status: OffRampStatus;
  @ApiPropertyOptional() providerReference: string | null;
  @ApiPropertyOptional() failureReason: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static from(o: OffRamp): OffRampResponseDto {
    const dto = new OffRampResponseDto();
    dto.id = o.id;
    dto.reference = o.reference;
    dto.amountUsdc = o.amountUsdc;
    dto.feeUsdc = o.feeUsdc;
    dto.netAmountUsdc = o.netAmountUsdc;
    dto.rate = o.rate;
    dto.spreadPercent = o.spreadPercent;
    dto.ngnAmount = o.ngnAmount;
    dto.bankAccountNumber = o.bankAccountNumber;
    dto.bankName = o.bankName;
    dto.accountName = o.accountName;
    dto.status = o.status;
    dto.providerReference = o.providerReference;
    dto.failureReason = o.failureReason;
    dto.createdAt = o.createdAt;
    dto.updatedAt = o.updatedAt;
    return dto;
  }
}
