import { IsNotEmpty, IsOptional, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefundPaymentDto {
  @ApiPropertyOptional({
    description: 'Amount to refund in USD. If not provided, the full payment amount will be refunded.',
    example: 10.50,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amountUsd?: number;

  @ApiProperty({
    description: 'Reason for the refund',
    example: 'Customer requested a return',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
