import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MerchantBusinessType,
  MerchantSettlementCurrency,
} from '../entities/merchant.entity';

export class RegisterMerchantDto {
  @ApiProperty({ example: 'Yaba Electronics', maxLength: 80 })
  @IsString()
  @MaxLength(80)
  businessName!: string;

  @ApiProperty({
    enum: MerchantBusinessType,
    example: MerchantBusinessType.RETAIL,
  })
  @IsEnum(MerchantBusinessType)
  businessType!: MerchantBusinessType;

  @ApiPropertyOptional({
    example: 'merchant-logos/yaba-electronics.webp',
    description: 'R2 object key for merchant logo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  logoKey?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({
    enum: MerchantSettlementCurrency,
    default: MerchantSettlementCurrency.NGN,
  })
  @IsOptional()
  @IsEnum(MerchantSettlementCurrency)
  settlementCurrency?: MerchantSettlementCurrency;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  autoSettleEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'USDC threshold for automatic settlement',
    default: 10,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  threshold?: number;

  @ApiPropertyOptional({
    description: 'Custom fee rate override (e.g. 0.015 = 1.5%). Null to use global default.',
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  customFeeRate?: number;
}
