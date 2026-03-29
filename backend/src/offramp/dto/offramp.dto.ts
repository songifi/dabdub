import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  IsInt,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OffRamp, OffRampStatus } from '../entities/off-ramp.entity';

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

export class OffRampPreviewResponseDto {
  @ApiProperty() amountUsdc: number;
  @ApiProperty() rate: string;
  @ApiProperty() spreadPercent: number;
  @ApiProperty() feeUsdc: string;
  @ApiProperty() netAmountUsdc: string;
  @ApiProperty() ngnAmount: string;
  @ApiProperty() bankAccount: {
    id: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null;
}

export class OffRampResponseDto {
  id: string;
  reference: string;
  amountUsdc: string;
  feeUsdc: string;
  netAmountUsdc: string;
  rate: string;
  spreadPercent: string;
  ngnAmount: string;
  bankAccountNumber: string;
  bankName: string;
  accountName: string;
  status: OffRampStatus;
  providerReference: string | null;
  failureReason: string | null;
  createdAt: Date;

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
    return dto;
  }
}
