import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ActivityService } from './activity.service';
import { QueryActivityDto } from './dto/query-activity.dto';
import {
  ActivityDetailDto,
  ActivityFeedDto,
  ActivitySummaryDto,
  MonthlyBreakdownItemDto,
} from './dto/activity-feed.dto';
import { Paginated } from '../common/decorators';

type AuthRequest = Request & { user: { id: string } };

@ApiTags('activity')
@ApiBearerAuth()
@Controller({ path: 'activity', version: '1' })
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  /**
   * GET /activity
   * Cursor-paginated activity feed with filtering and search.
   */
  @Get()
  @Paginated()
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Get paginated activity feed' })
  async getFeed(
    @Req() req: AuthRequest,
    @Query() query: QueryActivityDto,
  ): Promise<ActivityFeedDto> {
    return this.activityService.getFeed(req.user.id, query);
  }

  /**
   * GET /activity/summary
   * 30-day inflow/outflow summary.
   */
  @Get('summary')
  @ApiOperation({ summary: 'Get 30-day activity summary' })
  async getSummary(@Req() req: AuthRequest): Promise<ActivitySummaryDto> {
    return this.activityService.getSummary(req.user.id);
  }

  /**
   * GET /activity/monthly
   * Monthly breakdown for the last 6 months.
   */
  @Get('monthly')
  @ApiOperation({ summary: 'Get monthly breakdown for last 6 months' })
  async getMonthlyBreakdown(
    @Req() req: AuthRequest,
  ): Promise<MonthlyBreakdownItemDto[]> {
    return this.activityService.getMonthlyBreakdown(req.user.id);
  }

  /**
   * GET /activity/:id
   * Single activity detail with extended metadata.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get single activity detail' })
  async getDetail(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<ActivityDetailDto> {
    return this.activityService.getDetail(id, req.user.id);
  }
}
