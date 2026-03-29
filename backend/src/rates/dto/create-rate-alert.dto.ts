import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsPositive } from 'class-validator';
import { AlertDirection } from '../entities/rate-alert.entity';

export class CreateRateAlertDto {
  @ApiProperty({ description: 'Target NGN/USDC rate', example: 1600 })
  @IsNumber()
  @IsPositive()
  targetRate!: number;

  @ApiProperty({ enum: AlertDirection, description: 'Trigger when rate goes above or below target' })
  @IsEnum(AlertDirection)
  direction!: AlertDirection;
}
