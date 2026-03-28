import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { WaitlistService } from './waitlist.service';
import { WaitlistFraudService } from './waitlist-fraud.service';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { RankResponseDto } from './dto/rank-response.dto';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';
import { Public } from '../auth/decorators/public.decorator';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

@ApiTags('waitlist')
@Controller({ version: '1' })
export class WaitlistController {
  constructor(
    private readonly waitlistService: WaitlistService,
    private readonly fraudService: WaitlistFraudService,
  ) {}

  @Public()
  @Post('waitlist/join')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Join the waitlist' })
  join(
    @Body() dto: JoinWaitlistDto,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket.remoteAddress
      ?? '0.0.0.0';
    const fingerprint = req.headers['x-fingerprint'] as string | undefined;
    return this.waitlistService.join(dto, ip, fingerprint);
  }

  @Public()
  @Get('waitlist/rank')
  @ApiOperation({ summary: 'Get rank and referral info for an email' })
  @ApiQuery({ name: 'email', required: true })
  getRank(@Query('email') email: string): Promise<RankResponseDto> {
    return this.waitlistService.getRank(email);
  }

  @Public()
  @Get('waitlist/leaderboard')
  @ApiOperation({ summary: 'Top 100 waitlist leaderboard (cached 30s)' })
  getLeaderboard(): Promise<LeaderboardEntryDto[]> {
    return this.waitlistService.getLeaderboard();
  }

  @ApiBearerAuth()
  @UseGuards(SuperAdminGuard)
  @Get('admin/waitlist')
  @ApiOperation({ summary: 'Admin: paginated waitlist with fraud flags' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  adminList(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.waitlistService.adminList(Number(page), Number(limit));
  }

  @ApiBearerAuth()
  @UseGuards(SuperAdminGuard)
  @Get('admin/waitlist/fraud-logs')
  @ApiOperation({ summary: 'Admin: paginated fraud logs with filters' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'rule', required: false, example: 'IP_RATE_LIMIT' })
  @ApiQuery({ name: 'action', required: false, example: 'blocked' })
  getFraudLogs(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('rule') rule?: string,
    @Query('action') action?: string,
  ) {
    return this.fraudService.getFraudLogs(
      Number(page), 
      Number(limit), 
      rule, 
      action as any
    );
  }

  @ApiBearerAuth()
  @UseGuards(SuperAdminGuard)
  @Post('admin/waitlist/fraud/reset-ip/:ip')
  @ApiOperation({ summary: 'Admin: manually reset IP rate limit' })
  resetIpRateLimit(@Param('ip') ip: string) {
    return this.fraudService.resetIpRateLimit(ip);
  }
}
