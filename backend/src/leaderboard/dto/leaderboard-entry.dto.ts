import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty({ example: 1, description: '1-based rank position' })
  rank!: number;

  @ApiProperty({ example: 'a1b2c3d4-...', description: 'Entity UUID' })
  id!: string;

  @ApiProperty({ example: 'alice99', description: 'Display name shown on the leaderboard' })
  displayName!: string;

  @ApiProperty({ example: 4200, description: 'Leaderboard score' })
  score!: number;
}
