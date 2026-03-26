import { ApiProperty } from '@nestjs/swagger';
import { LeaderboardEntryDto } from './leaderboard-entry.dto';

export class LeaderboardResponseDto {
  @ApiProperty({ type: [LeaderboardEntryDto], description: 'Top-100 entries' })
  entries!: LeaderboardEntryDto[];

  @ApiProperty({ example: 42, nullable: true, description: 'Authenticated user\'s current rank, or null if not ranked' })
  currentUserRank!: number | null;
}
