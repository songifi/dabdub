import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, IsArray } from 'class-validator';

export class VolumeDataPointDto {
  @ApiProperty({ example: '2024-10-01' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: '1250.75' })
  @IsString()
  volumeUsdc!: string;
}

export class VolumeHistoryResponseDto {
  @ApiProperty({ type: [VolumeDataPointDto], example: [{ date: '2024-10-01', volumeUsdc: '1250.75' }] })
  @IsArray()
  data!: VolumeDataPointDto[];
}



