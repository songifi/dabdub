import {
  Controller,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { EarningsService } from './earnings.service';
import { TierService } from '../tier-config/tier.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('earnings')
export class EarningsController {
  constructor(
    private readonly earningsService: EarningsService,
    private readonly tierService: TierService,
  ) {}

  /**
   * GET /earnings
   * Authenticated — returns the full EarningsDashboardDto for the current user.
   */
  @Get()
  async getDashboard(@Req() req: any) {
    return this.earningsService.getDashboard(req.user.id);
  }

  /**
   * GET /earnings/history?page=1&limit=20
   * Authenticated — paginated yield history with running total.
   */
  @Get('history')
  async getYieldHistory(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.earningsService.getYieldHistory(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * GET /earnings/projections?additionalStake=50
   * Authenticated — 30/90/180/365-day projections at current APY.
   */
  @Get('projections')
  async getProjections(
    @Req() req: any,
    @Query('additionalStake') additionalStake?: string,
  ) {
    return this.earningsService.getProjections(
      req.user.id,
      additionalStake ? parseFloat(additionalStake) : 0,
    );
  }

  /**
   * GET /earnings/apy-tiers
   * Public — returns all active tier APY configurations.
   */
  @Public()
  @Get('apy-tiers')
  async getApyTiers() {
    const tiers = await this.tierService.getTierConfigs();
    return tiers.map((t) => ({
      tier: t.tier,
      yieldApyPercent: t.yieldApyPercent,
      minStakeAmountUsdc: t.minStakeAmountUsdc,
      stakeLockupDays: t.stakeLockupDays,
    }));
  }
}
