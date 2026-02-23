import {
  IsOptional,
  IsEnum,
  IsString,
  Length,
  IsDateString,
  IsNumberString,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { MerchantStatus } from '../../../database/entities/merchant.entity';
import { MerchantTier } from '../../../merchant/dto/merchant.dto';

export enum BusinessType {
  INDIVIDUAL = 'individual',
  SOLE_PROPRIETORSHIP = 'sole_proprietorship',
  PARTNERSHIP = 'partnership',
  LLC = 'llc',
  CORPORATION = 'corporation',
  NON_PROFIT = 'non_profit',
}

export class ListMerchantsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MerchantStatus })
  @IsOptional()
  @IsEnum(MerchantStatus)
  status?: MerchantStatus;

  @ApiPropertyOptional({
    example: 'US',
    description: '2-letter country code (ISO 3166-1 alpha-2)',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({ enum: MerchantTier })
  @IsOptional()
  @IsEnum(MerchantTier)
  tier?: MerchantTier;

  @ApiPropertyOptional({ enum: BusinessType })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @ApiPropertyOptional({ example: '100.00' })
  @IsOptional()
  @IsNumberString()
  minVolumeUsd?: string;

  @ApiPropertyOptional({ example: '50000.00' })
  @IsOptional()
  @IsNumberString()
  maxVolumeUsd?: string;

  @ApiPropertyOptional({ example: 'acme' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: [
      'createdAt',
      'businessName',
      'totalVolumeUsd',
      'totalTransactionCount',
      'activatedAt',
    ],
  })
  @IsOptional()
  @IsIn([
    'createdAt',
    'businessName',
    'totalVolumeUsd',
    'totalTransactionCount',
    'activatedAt',
  ])
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
