import { Controller, Get, Request, UseGuards, Version } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtGuard } from '../auth/guards/jwt.guard';
import {
  ReferralCodeResponseDto,
  ReferralStatsDto,
} from './dto/referral-stats.dto';
import { ReferralService } from './referral.service';

@ApiTags('Referrals')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtGuard)
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralService: ReferralService) {}

  @Version('1')
  @Get('code')
  @ApiOperation({ summary: 'Get or generate the current user referral code' })
  @ApiResponse({
    status: 200,
    type: ReferralCodeResponseDto,
  })
  async getCode(@Request() req: any): Promise<ReferralCodeResponseDto> {
    return {
      code: await this.referralService.generateCode(req.user.id),
    };
  }

  @Version('1')
  @Get('stats')
  @ApiOperation({ summary: 'Get referral stats for the current user' })
  @ApiResponse({
    status: 200,
    type: ReferralStatsDto,
  })
  getStats(@Request() req: any): Promise<ReferralStatsDto> {
    return this.referralService.getStats(req.user.id);
  }
}
