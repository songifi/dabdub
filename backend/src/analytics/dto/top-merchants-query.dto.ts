import { IsOptional, IsIn, IsNumberString, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class TopMerchantsQueryDto {
  @IsOptional()
  @IsNumberString()
  @Transform(({ value }) => parseInt(value, 10))
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsIn(['7d', '30d', '90d'])
  period?: string = '30d';
}