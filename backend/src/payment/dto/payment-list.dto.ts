import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested, IsInt, Min, IsObject } from 'class-validator';
import { PaymentDetailsDto } from './payment-details.dto';

class PaginationDto {
  @ApiProperty({ description: 'Current page number' })
  @IsInt()
  @Min(1)
  page: number;

  @ApiProperty({ description: 'Page size / limit' })
  @IsInt()
  @Min(1)
  limit: number;

  @ApiProperty({ description: 'Total number of payments' })
  @IsInt()
  @Min(0)
  total: number;

  @ApiProperty({ description: 'Total number of pages' })
  @IsInt()
  @Min(0)
  totalPages: number;
}

export class PaymentListDto {
  @ApiProperty({ type: [PaymentDetailsDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDetailsDto)
  data: PaymentDetailsDto[];

  @ApiProperty({ type: PaginationDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PaginationDto)
  pagination: PaginationDto;
}
