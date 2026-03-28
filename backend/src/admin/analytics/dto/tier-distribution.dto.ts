import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray } from 'class-validator';

export class TierDistributionItemDto {
  @ApiProperty({ example: 'Silver' })
  @IsString()
  tier!: string;

  @ApiProperty({ example: 950 })
  @IsNumber()
  count!: number;

  @ApiProperty({ example: 76.0 })
  @IsNumber()
  percent!: number;
}

export class TierDistributionDto {
  @ApiProperty({ type: [TierDistributionItemDto], example: [{ tier: 'Silver', count: 950, percent: 76.0 }, ...] })
  @IsArray()
  tiers!: TierDistributionItemDto[];
}



