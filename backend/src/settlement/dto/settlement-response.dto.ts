import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SettlementStatus,
  SettlementProvider,
} from '../entities/settlement.entity';

export class SettlementResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  paymentRequestId!: string;

  @ApiProperty()
  merchantId!: string;

  @ApiProperty({ example: 1000.5 })
  amount!: number;

  @ApiProperty({ example: 10.05 })
  feeAmount!: number;

  @ApiProperty({ example: 990.45 })
  netAmount!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ enum: SettlementStatus })
  status!: SettlementStatus;

  @ApiPropertyOptional({ enum: SettlementProvider })
  provider?: SettlementProvider;

  @ApiPropertyOptional()
  settlementReference?: string;

  @ApiPropertyOptional()
  failureReason?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  settledAt?: Date;

  @ApiPropertyOptional()
  processedAt?: Date;

  @ApiPropertyOptional()
  bankAccountNumber?: string;

  @ApiPropertyOptional()
  bankName?: string;
}

export class SettlementStatsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  pending!: number;

  @ApiProperty()
  processing!: number;

  @ApiProperty()
  completed!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty()
  totalAmount!: number;

  @ApiProperty()
  totalFees!: number;
}
