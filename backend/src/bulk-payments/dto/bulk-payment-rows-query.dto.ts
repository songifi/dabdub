import { IsEnum, IsOptional } from 'class-validator';
import { BulkPaymentRowStatus } from '../entities/bulk-payment-row.entity';

export class BulkPaymentRowsQueryDto {
  @IsOptional()
  @IsEnum(BulkPaymentRowStatus)
  status?: BulkPaymentRowStatus;

  @IsOptional()
  limit?: number = 20;

  @IsOptional()
  cursor?: string;
}