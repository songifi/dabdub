import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray } from 'class-validator';

export class FunnelStageDto {
  @ApiProperty({ example: 'waitlist' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 350 })
  @IsNumber()
  count!: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  percent!: number;
}

export class ConversionFunnelDto {
  @ApiProperty({ type: [FunnelStageDto], example: [{ name: 'waitlist', count: 350, percent: 100 }, ...] })
  @IsArray()
  stages!: FunnelStageDto[];

  @ApiProperty({ example: 350 })
  @IsNumber()
  total!: number;
}



