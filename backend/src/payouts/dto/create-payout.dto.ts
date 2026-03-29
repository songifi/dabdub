import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import { Frequency } from '../entities/scheduled-payout.entity';

export class CreatePayoutDto {
  @IsString()
  @IsNotEmpty()
  toUsername!: string;

  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsEnum(Frequency)
  frequency!: Frequency;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(28)
  dayOfMonth?: number;

  @IsString()
  @IsNotEmpty()
  pin!: string;
}
