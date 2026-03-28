import { ApiProperty } from '@nestjs/swagger';

export class RankResponseDto {
  @ApiProperty() rank!: number;
  @ApiProperty() points!: number;
  @ApiProperty() referralCode!: string;
  @ApiProperty() referralLink!: string;
  @ApiProperty() totalEntries!: number;
}
