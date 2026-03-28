import {
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BalanceService } from './balance.service';
import { BalanceDto } from './dto/balance.dto';
import { BalanceHistoryDto } from './dto/balance-history.dto';

@Controller({ path: 'balance', version: '1' })
@UseGuards(JwtAuthGuard)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  /**
   * GET /balance
   * Authenticated — returns cached BalanceDto for the current user.
   */
  @Get()
  async getBalance(@Req() req: any): Promise<BalanceDto> {
    const userId = req.user.id;
    return this.balanceService.getBalance(userId);
  }

  /**
   * POST /balance/refresh
   * Authenticated — force sync balance from blockchain.
   * Rate limited: 1 request per 10 seconds per user.
   */
  @Post('refresh')
  @Throttle({ default: { limit: 1, ttl: 10 } })
  async refreshBalance(@Req() req: any): Promise<BalanceDto> {
    const userId = req.user.id;
    return this.balanceService.refreshBalance(userId);
  }

  /**
   * GET /balance/history
   * Authenticated — returns 30-day balance history for chart.
   */
  @Get('history')
  async getBalanceHistory(@Req() req: any): Promise<BalanceHistoryDto> {
    const userId = req.user.id;
    return this.balanceService.getBalanceHistory(userId);
  }
}
