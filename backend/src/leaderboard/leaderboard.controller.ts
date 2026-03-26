import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardResponseDto } from './dto/leaderboard-response.dto';
import { Request } from 'express';

type NamespaceParam = 'waitlist' | 'users';

@ApiTags('leaderboard')
@ApiBearerAuth()
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get top-100 leaderboard with optional current-user rank' })
  @ApiQuery({ name: 'namespace', enum: ['waitlist', 'users'], required: false, example: 'users' })
  @ApiResponse({ status: 200, type: LeaderboardResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid namespace' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getLeaderboard(
    @Query('namespace') namespace: NamespaceParam = 'users',
    @Req() req: Request,
  ) {
    const entries = await this.leaderboardService.getTop100Cached(namespace);

    const userId: string | undefined = (req as any).user?.id;
    const currentUserRank = userId
      ? await this.leaderboardService.getRank(userId, namespace)
      : null;

    return { entries, currentUserRank };
  }
}
