import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardResponseDto } from './dto/leaderboard-response.dto';
import type { Request } from 'express';

type NamespaceParam = 'waitlist' | 'users';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Leaderboard top entries and optional current user rank',
    description:
      'Public endpoint. When called with a valid JWT, includes the caller rank in `currentUserRank`.',
  })
  @ApiQuery({
    name: 'namespace',
    required: false,
    enum: ['waitlist', 'users'],
    description: 'Leaderboard namespace',
    example: 'users',
  })
  @ApiOkResponse({ type: LeaderboardResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid namespace' })
  @ApiUnauthorizedResponse({ description: 'JWT invalid when provided' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getLeaderboard(
    @Query('namespace') namespace: NamespaceParam = 'users',
    @Req() req: Request,
  ): Promise<LeaderboardResponseDto> {
    const entries = await this.leaderboardService.getTop100Cached(namespace);

    const userId: string | undefined = (req as any).user?.id;
    const currentUserRank = userId
      ? await this.leaderboardService.getRank(userId, namespace)
      : null;

    return { entries, currentUserRank };
  }
}
