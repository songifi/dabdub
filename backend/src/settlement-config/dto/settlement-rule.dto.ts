import { IsString, IsInt, IsArray, ValidateNested, IsOptional, IsDateString, Min, MinLength, IsObject, IsEnum, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class SettlementConditionDto {
  @IsEnum(['merchant.tier', 'transaction.usdAmount', 'transaction.chain', 'merchant.settlementCurrency', 'merchant.country'])
  field: 'merchant.tier' | 'transaction.usdAmount' | 'transaction.chain' | 'merchant.settlementCurrency' | 'merchant.country';

  @IsEnum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'not_in'])
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in';

  @IsNotEmpty()
  value: string | number | string[];
}

export class SettlementActionDto {
  @IsOptional()
  @IsString()
  liquidityProvider?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  settlementDelay?: number;

  @IsOptional()
  @IsEnum(['SAME_CURRENCY', 'SAME_MERCHANT', 'IMMEDIATE'])
  batchWith?: 'SAME_CURRENCY' | 'SAME_MERCHANT' | 'IMMEDIATE';

  @IsOptional()
  requireManualApproval?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumBatchAmount?: number;
}

export class CreateSettlementRuleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @MinLength(20)
  description: string;

  @IsInt()
  @Min(1)
  priority: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettlementConditionDto)
  conditions: SettlementConditionDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => SettlementActionDto)
  actions: SettlementActionDto;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateSettlementRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettlementConditionDto)
  conditions?: SettlementConditionDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SettlementActionDto)
  actions?: SettlementActionDto;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  isEnabled?: boolean;
}

export class ReorderSettlementRulesDto {
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}

export class TestSettlementRuleDto {
  @IsObject()
  sampleTransaction: {
    chain: string;
    usdAmount: string | number;
    tokenSymbol: string;
  };

  @IsObject()
  sampleMerchant: {
    tier: string;
    country: string;
    settlementCurrency: string;
  };
}
