import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsArray } from 'class-validator';

export class GrowthDataPointDto {
  @ApiProperty({ example: '2024-10-01' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 15 })
  @IsNumber()
  newUsers!: number;
}

export class UserGrowthResponseDto {
  @ApiProperty({ type: [GrowthDataPointDto], example: [{ date: '2024-10-01', newUsers: 15 }] })
  @IsArray()
  data!: GrowthDataPointDto[];
}



