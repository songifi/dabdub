import {
  IsString,
  IsBoolean,
  IsOptional,
  IsDecimal,
  IsEnum,
  IsArray,
  IsInt,
  Min,
  Max,
  Length,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RateSource } from '../../database/entities/fiat-currency-config.entity';

export class AddFiatCurrencyDto {
  @IsString()
  @Length(3, 3)
  currencyCode: string;

  @IsString()
  displayName: string;

  @IsString()
  @Length(1, 5)
  symbol: string;

  @IsDecimal()
  minimumSettlementAmount: string;

  @IsDecimal()
  @IsOptional()
  maximumSettlementAmount?: string;

  @IsDecimal()
  minimumTransactionAmount: string;

  @IsEnum(RateSource)
  rateSource: RateSource;

  @IsString()
  @IsOptional()
  rateSourceConfig?: string;

  @IsArray()
  @IsString({ each: true })
  supportedLiquidityProviders: string[];

  @IsInt()
  @Min(1)
  @Max(168)
  defaultSettlementDelayHours: number;

  @IsObject()
  @IsOptional()
  operatingHours?: Record<string, string>;
}

export class UpdateFiatCurrencyDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  @Length(1, 5)
  symbol?: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsDecimal()
  @IsOptional()
  minimumSettlementAmount?: string;

  @IsDecimal()
  @IsOptional()
  maximumSettlementAmount?: string;

  @IsDecimal()
  @IsOptional()
  minimumTransactionAmount?: string;

  @IsEnum(RateSource)
  @IsOptional()
  rateSource?: RateSource;

  @IsString()
  @IsOptional()
  rateSourceConfig?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supportedLiquidityProviders?: string[];

  @IsInt()
  @Min(1)
  @Max(168)
  @IsOptional()
  defaultSettlementDelayHours?: number;

  @IsObject()
  @IsOptional()
  operatingHours?: Record<string, string>;
}

export class UpdateBankDetailsDto {
  @IsString()
  bankName: string;

  @IsString()
  accountName: string;

  @IsString()
  accountNumber: string;

  @IsString()
  @IsOptional()
  routingCode?: string;

  @IsString()
  @IsOptional()
  swiftCode?: string;

  @IsString()
  @IsOptional()
  bankAddress?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsObject()
  @IsOptional()
  additionalDetails?: Record<string, any>;
}
