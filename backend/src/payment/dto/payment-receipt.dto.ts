import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsNumber,
  IsDate,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentStatus } from '../../database/entities/payment.entity';

export class PaymentReceiptDto {
  @ApiProperty({ description: 'Payment ID', type: String })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Payment reference' })
  @IsString()
  reference?: string;

  @ApiProperty({ description: 'Payment amount' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Currency' })
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Payment status' })
  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @ApiProperty({ description: 'Payment description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Payment created date/time' })
  @Type(() => Date)
  @IsDate()
  createdAt: Date;

  @ApiProperty({ description: 'Payment completed date/time' })
  @Type(() => Date)
  @IsDate()
  completedAt: Date;
}
