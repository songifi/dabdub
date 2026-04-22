import { ApiProperty } from '@nestjs/swagger';
import { LeaderboardEntryDto } from './leaderboard-entry.dto';

export class LeaderboardResponseDto {
  @ApiProperty({ type: [LeaderboardEntryDto] })
  entries!: LeaderboardEntryDto[];

  @ApiProperty({ type: Number, nullable: true, description: 'Rank of authenticated user, if any' })
  currentUserRank!: number | null;
}
