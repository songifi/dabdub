import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  FeeRateType,
  FeeType,
} from '../../fee-config/entities/fee-config.entity';

export class CreateFeeConfigDto {
  @IsEnum(FeeType)
  type!: FeeType;

  @IsEnum(FeeRateType)
  rateType!: FeeRateType;

  @IsString()
  value!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
