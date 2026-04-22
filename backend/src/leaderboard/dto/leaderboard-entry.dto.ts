import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty({ example: 1, description: '1-based rank position' })
  rank!: number;

  @ApiProperty({ format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ example: 'alice99', description: 'Display name shown on the leaderboard' })
  displayName!: string;

  @ApiProperty({ example: 4200, description: 'Leaderboard score' })
  score!: number;
}
