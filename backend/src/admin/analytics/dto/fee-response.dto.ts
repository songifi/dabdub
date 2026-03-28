import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, IsArray } from 'class-validator';

export class FeeDataPointDto {
  @ApiProperty({ example: '2024-10-01' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: '25.50' })
  @IsString()
  transferFees!: string;

  @ApiProperty({ example: '30.00' })
  @IsString()
  withdrawalFees!: string;

  @ApiProperty({ example: '20.00' })
  @IsString()
  paylinkFees!: string;

  @ApiProperty({ example: '75.50' })
  @IsString()
  totalFees!: string;
}

export class FeeRevenueResponseDto {
  @ApiProperty({ type: [FeeDataPointDto], example: [{ date: '2024-10-01', transferFees: '25.50', ... }] })
  @IsArray()
  data!: FeeDataPointDto[];
}



