import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty() rank!: number;
  @ApiProperty() name!: string;
  @ApiProperty() points!: number;
  @ApiProperty() referralCode!: string;
}
