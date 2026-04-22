import { ApiProperty } from '@nestjs/swagger';
import { LeaderboardEntryDto } from './leaderboard-entry.dto';

export class LeaderboardResponseDto {
  @ApiProperty({ type: [LeaderboardEntryDto], description: 'Top-100 entries' })
  entries!: LeaderboardEntryDto[];

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 42,
    description: "Authenticated user's current rank, or null if not ranked",
  })
  currentUserRank!: number | null;
}
