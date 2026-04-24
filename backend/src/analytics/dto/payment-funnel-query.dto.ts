import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentNetwork } from '../../payments/entities/payment.entity';

export class PaymentFunnelQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(PaymentNetwork)
  network?: PaymentNetwork;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toLowerCase())
  period?: 'day' | 'week' | 'month';
}