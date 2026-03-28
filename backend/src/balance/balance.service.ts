import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { User } from '../users/entities/user.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../transactions/entities/transaction.entity';
import { SorobanService } from '../soroban/soroban.service';
import { RatesService } from '../rates/rates.service';
import { CacheService } from '../cache/cache.service';
import { BalanceDto } from './dto/balance.dto';
import { BalanceHistoryDto, BalanceHistoryPoint } from './dto/balance-history.dto';
import { BalanceSnapshot } from './entities/balance-snapshot.entity';

const BALANCE_CACHE_TTL_SECONDS = 30;
const BALANCE_CACHE_KEY = (userId: string) => `balance:${userId}`;

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    @InjectRepository(BalanceSnapshot)
    private readonly snapshotRepo: Repository<BalanceSnapshot>,

    private readonly sorobanService: SorobanService,
    private readonly ratesService: RatesService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get cached balance for user. Returns from Redis cache if available.
   */
  async getBalance(userId: string): Promise<BalanceDto> {
    const cacheKey = BALANCE_CACHE_KEY(userId);
    const cached = await this.cacheService.get<BalanceDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for balance:${userId}`);
      return cached;
    }

    // If not in cache, compute from DB (cached wallet balance)
    return this.computeBalanceFromDb(userId);
  }

  /**
   * Force refresh balance from blockchain. Updates DB and cache.
   * Rate limiting should be applied at controller level.
   */
  async refreshBalance(userId: string): Promise<BalanceDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get balances from Soroban contract
    const [balanceUsdcRaw, stakedBalanceUsdcRaw] = await Promise.all([
      this.sorobanService.getBalance(user.username),
      this.sorobanService.getStakeBalance(user.username),
    ]);

    // Convert to string (handle different response types)
    const balanceUsdc = this.extractAmount(balanceUsdcRaw);
    const stakedBalanceUsdc = this.extractAmount(stakedBalanceUsdcRaw);
    const totalUsdc = this.addAmounts(balanceUsdc, stakedBalanceUsdc);

    // Get current rate
    const rateData = await this.ratesService.getRate('USDC', 'NGN');
    const rate = rateData.rate;
    const rateNum = parseFloat(rate);

    // Calculate NGN equivalents
    const balanceNgn = (parseFloat(balanceUsdc) * rateNum).toFixed(2);
    const stakedBalanceNgn = (parseFloat(stakedBalanceUsdc) * rateNum).toFixed(2);

    // Calculate 24h change
    const change24h = await this.calculate24hChange(userId);

    const now = new Date();
    const balance: BalanceDto = {
      balanceUsdc,
      stakedBalanceUsdc,
      totalUsdc,
      balanceNgn,
      stakedBalanceNgn,
      rate,
      lastSyncedAt: now.toISOString(),
      change24h,
    };

    // Cache the result
    await this.cacheService.set(
      BALANCE_CACHE_KEY(userId),
      balance,
      BALANCE_CACHE_TTL_SECONDS,
    );

    // Save daily snapshot
    await this.saveDailySnapshot(userId, balance, now);

    this.logger.log(
      `Refreshed balance for user ${userId}: ${totalUsdc} USDC`,
    );

    return balance;
  }

  /**
   * Get 30-day balance history for chart.
   * Returns daily snapshots computed from transaction history.
   */
  async getBalanceHistory(userId: string): Promise<BalanceHistoryDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get last 30 days of snapshots from DB
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const snapshots = await this.snapshotRepo.find({
      where: {
        userId,
        snapshotDate: Between(
          thirtyDaysAgo.toISOString().split('T')[0],
          new Date().toISOString().split('T')[0],
        ),
      },
      order: { snapshotDate: 'ASC' },
    });

    // If we have snapshots, return them
    if (snapshots.length > 0) {
      const points: BalanceHistoryPoint[] = snapshots.map((s) => ({
        date: s.snapshotDate,
        balanceUsdc: s.balanceUsdc,
        stakedBalanceUsdc: s.stakedBalanceUsdc,
        totalUsdc: s.totalUsdc,
      }));

      return { points };
    }

    // Fallback: compute from transaction history if no snapshots exist
    return this.computeBalanceHistoryFromTransactions(userId);
  }

  /**
   * Invalidate balance cache for a user.
   * Called when a transaction is confirmed.
   */
  async invalidateCache(userId: string): Promise<void> {
    await this.cacheService.del(BALANCE_CACHE_KEY(userId));
    this.logger.debug(`Invalidated balance cache for user ${userId}`);
  }

  /**
   * Compute balance from database (cached wallet balance).
   * This is used when Redis cache is empty but we want to avoid chain calls.
   */
  private async computeBalanceFromDb(userId: string): Promise<BalanceDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate balances from transactions
    const stakeResult = await this.txRepo
      .createQueryBuilder('tx')
      .select(
        `COALESCE(SUM(CASE WHEN tx.type = :stakeType THEN CAST(tx.amount_usdc AS NUMERIC) ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN tx.type = :unstakeType THEN CAST(tx.amount_usdc AS NUMERIC) ELSE 0 END), 0)`,
        'staked',
      )
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.type IN (:...types)', {
        types: [TransactionType.STAKE, TransactionType.UNSTAKE],
      })
      .setParameter('stakeType', TransactionType.STAKE)
      .setParameter('unstakeType', TransactionType.UNSTAKE)
      .getRawOne();

    const stakedBalanceUsdc = parseFloat(stakeResult?.staked || '0').toFixed(8);

    // Liquid balance
    const liquidResult = await this.txRepo
      .createQueryBuilder('tx')
      .select(
        `COALESCE(SUM(CASE WHEN tx.type IN (:...creditTypes) THEN CAST(tx.amount_usdc AS NUMERIC) ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN tx.type IN (:...debitTypes) THEN CAST(tx.amount_usdc AS NUMERIC) ELSE 0 END), 0)`,
        'liquid',
      )
      .where('tx.user_id = :userId', { userId })
      .setParameter('creditTypes', [
        TransactionType.DEPOSIT,
        TransactionType.TRANSFER_IN,
        TransactionType.YIELD_CREDIT,
        TransactionType.PAYLINK_RECEIVED,
      ])
      .setParameter('debitTypes', [
        TransactionType.WITHDRAWAL,
        TransactionType.TRANSFER_OUT,
        TransactionType.PAYLINK_SENT,
      ])
      .getRawOne();

    const totalLiquid = parseFloat(liquidResult?.liquid || '0');
    const balanceUsdc = (totalLiquid - parseFloat(stakedBalanceUsdc)).toFixed(8);
    const totalUsdc = this.addAmounts(balanceUsdc, stakedBalanceUsdc);

    // Get rate
    let rate = '0';
    try {
      const rateData = await this.ratesService.getRate('USDC', 'NGN');
      rate = rateData.rate;
    } catch {
      // Use last known rate or default
      rate = '1500'; // Fallback rate
    }

    const rateNum = parseFloat(rate);
    const balanceNgn = (parseFloat(balanceUsdc) * rateNum).toFixed(2);
    const stakedBalanceNgn = (parseFloat(stakedBalanceUsdc) * rateNum).toFixed(2);

    // Calculate 24h change
    const change24h = await this.calculate24hChange(userId);

    return {
      balanceUsdc,
      stakedBalanceUsdc,
      totalUsdc,
      balanceNgn,
      stakedBalanceNgn,
      rate,
      lastSyncedAt: new Date().toISOString(),
      change24h,
    };
  }

  /**
   * Calculate 24h balance change.
   * Compares current balance to transaction sum from last 24h.
   * Formula: sum(transfer_in + deposit + yield) - sum(transfer_out + withdrawal)
   */
  private async calculate24hChange(userId: string): Promise<string | null> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const result = await this.txRepo
      .createQueryBuilder('tx')
      .select(
        `COALESCE(SUM(CASE WHEN tx.type IN (:...creditTypes) THEN CAST(tx.amount_usdc AS NUMERIC) ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN tx.type IN (:...debitTypes) THEN CAST(tx.amount_usdc AS NUMERIC) ELSE 0 END), 0)`,
        'change',
      )
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.createdAt >= :since', { since: twentyFourHoursAgo })
      .setParameter('creditTypes', [
        TransactionType.DEPOSIT,
        TransactionType.TRANSFER_IN,
        TransactionType.YIELD_CREDIT,
        TransactionType.PAYLINK_RECEIVED,
      ])
      .setParameter('debitTypes', [
        TransactionType.WITHDRAWAL,
        TransactionType.TRANSFER_OUT,
        TransactionType.PAYLINK_SENT,
      ])
      .getRawOne();

    const change = parseFloat(result?.change || '0');

    // Return null if no transactions in last 24h
    if (change === 0) {
      return null;
    }

    return change.toFixed(8);
  }

  /**
   * Save daily balance snapshot.
   * Only saves one snapshot per day per user.
   */
  private async saveDailySnapshot(
    userId: string,
    balance: BalanceDto,
    timestamp: Date,
  ): Promise<void> {
    const snapshotDate = timestamp.toISOString().split('T')[0];

    // Check if snapshot already exists for today
    const existing = await this.snapshotRepo.findOne({
      where: { userId, snapshotDate },
    });

    if (existing) {
      // Update existing snapshot
      existing.balanceUsdc = balance.balanceUsdc;
      existing.stakedBalanceUsdc = balance.stakedBalanceUsdc;
      existing.totalUsdc = balance.totalUsdc;
      existing.rate = balance.rate;
      await this.snapshotRepo.save(existing);
    } else {
      // Create new snapshot
      await this.snapshotRepo.save(
        this.snapshotRepo.create({
          userId,
          snapshotDate,
          balanceUsdc: balance.balanceUsdc,
          stakedBalanceUsdc: balance.stakedBalanceUsdc,
          totalUsdc: balance.totalUsdc,
          rate: balance.rate,
        }),
      );
    }
  }

  /**
   * Compute balance history from transactions (fallback when no snapshots exist).
   */
  private async computeBalanceHistoryFromTransactions(
    userId: string,
  ): Promise<BalanceHistoryDto> {
    const points: BalanceHistoryPoint[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all transactions for the last 30 days
    const transactions = await this.txRepo.find({
      where: {
        userId,
        createdAt: Between(thirtyDaysAgo, now),
        status: TransactionStatus.COMPLETED,
      },
      order: { createdAt: 'ASC' },
    });

    // Group transactions by day and calculate running balance
    const transactionsByDay = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const day = tx.createdAt.toISOString().split('T')[0];
      const existing = transactionsByDay.get(day) || [];
      existing.push(tx);
      transactionsByDay.set(day, existing);
    }

    // Calculate running balance for each day
    let runningBalance = 0;
    let runningStaked = 0;

    // Get starting balance (before 30 days)
    const beforeThirtyDays = await this.txRepo
      .createQueryBuilder('tx')
      .select(
        `COALESCE(SUM(CASE WHEN tx.type IN (:...creditTypes) THEN CAST(tx.amount_usdc AS NUMERIC) ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN tx.type IN (:...debitTypes) THEN CAST(tx.amount_usdc AS NUMERIC) ELSE 0 END), 0)`,
        'balance',
      )
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.createdAt < :since', { since: thirtyDaysAgo })
      .setParameter('creditTypes', [
        TransactionType.DEPOSIT,
        TransactionType.TRANSFER_IN,
        TransactionType.YIELD_CREDIT,
        TransactionType.PAYLINK_RECEIVED,
        TransactionType.STAKE,
      ])
      .setParameter('debitTypes', [
        TransactionType.WITHDRAWAL,
        TransactionType.TRANSFER_OUT,
        TransactionType.PAYLINK_SENT,
        TransactionType.UNSTAKE,
      ])
      .getRawOne();

    runningBalance = parseFloat(beforeThirtyDays?.balance || '0');

    // Generate a point for each day in the last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const daysTxs = transactionsByDay.get(dateStr) || [];

      // Process transactions for this day
      for (const tx of daysTxs) {
        const amount = parseFloat(tx.amountUsdc);
        if (
          tx.type === TransactionType.STAKE ||
          tx.type === TransactionType.DEPOSIT ||
          tx.type === TransactionType.TRANSFER_IN ||
          tx.type === TransactionType.YIELD_CREDIT ||
          tx.type === TransactionType.PAYLINK_RECEIVED
        ) {
          runningBalance += amount;
          if (tx.type === TransactionType.STAKE) {
            runningStaked += amount;
          }
        } else if (
          tx.type === TransactionType.UNSTAKE ||
          tx.type === TransactionType.WITHDRAWAL ||
          tx.type === TransactionType.TRANSFER_OUT ||
          tx.type === TransactionType.PAYLINK_SENT
        ) {
          runningBalance -= amount;
          if (tx.type === TransactionType.UNSTAKE) {
            runningStaked -= amount;
          }
        }
      }

      const liquidBalance = Math.max(0, runningBalance - runningStaked);
      const total = liquidBalance + runningStaked;

      points.push({
        date: dateStr,
        balanceUsdc: liquidBalance.toFixed(8),
        stakedBalanceUsdc: runningStaked.toFixed(8),
        totalUsdc: total.toFixed(8),
      });
    }

    return { points };
  }

  /**
   * Extract amount from Soroban response.
   * Handles different response formats.
   */
  private extractAmount(raw: unknown): string {
    if (typeof raw === 'string') {
      return raw;
    }
    if (typeof raw === 'number') {
      return raw.toFixed(8);
    }
    if (raw && typeof raw === 'object' && 'value' in raw) {
      return String((raw as any).value);
    }
    return '0';
  }

  /**
   * Add two amount strings.
   */
  private addAmounts(a: string, b: string): string {
    return (parseFloat(a) + parseFloat(b)).toFixed(8);
  }
}
