import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateMerchantDto {
  @ApiPropertyOptional({ example: 'Yaba Electronics', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  businessName?: string;

  @ApiPropertyOptional({
    enum: MerchantBusinessType,
    example: MerchantBusinessType.RETAIL,
  })
  @IsOptional()
  @IsEnum(MerchantBusinessType)
  businessType?: MerchantBusinessType;

  @ApiPropertyOptional({
    example: 'merchant-logos/yaba-electronics.webp',
    description: 'R2 object key for merchant logo',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  logoKey?: string | null;

  @ApiPropertyOptional({ maxLength: 300, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @ApiPropertyOptional({ enum: MerchantSettlementCurrency })
  @IsOptional()
  @IsEnum(MerchantSettlementCurrency)
  settlementCurrency?: MerchantSettlementCurrency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSettleEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'USDC threshold for automatic settlement',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  threshold?: number;
}
