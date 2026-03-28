import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  SelectQueryBuilder,
  MoreThanOrEqual,
  LessThanOrEqual,
  And,
} from 'typeorm';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import {
  ActivityFeedDto,
  ActivityFeedItemDto,
  ActivitySummaryDto,
  MonthlyBreakdownItemDto,
  ActivityDetailDto,
  CounterpartyDto,
} from './dto/activity-feed.dto';
import { QueryActivityDto } from './dto/query-activity.dto';

/** Maps transaction type to a human-readable label */
const DISPLAY_TYPE_MAP: Record<TransactionType, string> = {
  [TransactionType.DEPOSIT]: 'Deposit',
  [TransactionType.WITHDRAWAL]: 'Withdrawal',
  [TransactionType.TRANSFER_IN]: 'Received',
  [TransactionType.TRANSFER_OUT]: 'Sent',
  [TransactionType.PAYLINK_RECEIVED]: 'Pay Link Received',
  [TransactionType.PAYLINK_SENT]: 'Pay Link Sent',
  [TransactionType.STAKE]: 'Staked',
  [TransactionType.UNSTAKE]: 'Unstaked',
  [TransactionType.YIELD_CREDIT]: 'Yield Earned',
};

/** Maps transaction type to an icon identifier */
const ICON_MAP: Record<TransactionType, string> = {
  [TransactionType.DEPOSIT]: 'arrow-down-circle',
  [TransactionType.WITHDRAWAL]: 'arrow-up-circle',
  [TransactionType.TRANSFER_IN]: 'arrow-down-left',
  [TransactionType.TRANSFER_OUT]: 'arrow-up-right',
  [TransactionType.PAYLINK_RECEIVED]: 'link-incoming',
  [TransactionType.PAYLINK_SENT]: 'link-outgoing',
  [TransactionType.STAKE]: 'lock',
  [TransactionType.UNSTAKE]: 'unlock',
  [TransactionType.YIELD_CREDIT]: 'sparkles',
};

/** Types that represent inflow (money coming in) */
const INFLOW_TYPES = new Set<TransactionType>([
  TransactionType.DEPOSIT,
  TransactionType.TRANSFER_IN,
  TransactionType.PAYLINK_RECEIVED,
  TransactionType.UNSTAKE,
  TransactionType.YIELD_CREDIT,
]);

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ── Feed ─────────────────────────────────────────────────────────────────

  async getFeed(userId: string, query: QueryActivityDto): Promise<ActivityFeedDto> {
    const limit = Math.min(query.limit ?? 20, 50);

    const qb = this.txRepo
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId })
      .orderBy('tx.createdAt', 'DESC')
      .take(limit + 1);

    this.applyFilters(qb, query);

    const rows = await qb.getMany();

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    let nextCursor: string | undefined;
    if (hasMore) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(last.createdAt.toISOString()).toString('base64');
    }

    // Batch-load counterparty profiles to avoid N+1
    const counterpartyMap = await this.batchLoadCounterparties(items);

    return {
      data: items.map((tx) => this.toFeedItem(tx, counterpartyMap)),
      limit,
      hasMore,
      nextCursor,
    };
  }

  // ── Single detail ─────────────────────────────────────────────────────────

  async getDetail(id: string, userId: string): Promise<ActivityDetailDto> {
    const tx = await this.txRepo.findOne({ where: { id, userId } });
    if (!tx) throw new NotFoundException(`Activity ${id} not found`);

    const counterpartyMap = await this.batchLoadCounterparties([tx]);
    const base = this.toFeedItem(tx, counterpartyMap);

    const detail = new ActivityDetailDto();
    Object.assign(detail, base);
    detail.blockchainTxHash =
      (tx.metadata?.['txHash'] as string | undefined) ?? null;
    detail.reference = tx.reference;
    detail.balanceAfter = tx.balanceAfter;
    detail.metadata = tx.metadata;
    return detail;
  }

  // ── Summary (30-day) ──────────────────────────────────────────────────────

  async getSummary(userId: string): Promise<ActivitySummaryDto> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const rows = await this.txRepo.find({
      where: {
        userId,
        status: TransactionStatus.COMPLETED,
        createdAt: MoreThanOrEqual(since),
      },
      select: ['type', 'amountUsdc'],
    });

    let inflow = 0;
    let outflow = 0;

    for (const tx of rows) {
      const val = parseFloat(tx.amountUsdc ?? '0');
      if (INFLOW_TYPES.has(tx.type)) {
        inflow += val;
      } else {
        outflow += val;
      }
    }

    const count = rows.length;
    const avg = count > 0 ? (inflow + outflow) / count : 0;

    return {
      totalInflow: inflow.toFixed(8),
      totalOutflow: outflow.toFixed(8),
      transactionCount: count,
      averageTransactionValue: avg.toFixed(8),
    };
  }

  // ── Monthly breakdown (last 6 months) ────────────────────────────────────

  async getMonthlyBreakdown(userId: string): Promise<MonthlyBreakdownItemDto[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await this.txRepo.find({
      where: {
        userId,
        status: TransactionStatus.COMPLETED,
        createdAt: MoreThanOrEqual(since),
      },
      select: ['type', 'amountUsdc', 'createdAt'],
    });

    // Build a map keyed by "YYYY-MM"
    const buckets = new Map<string, { incoming: number; outgoing: number }>();

    // Pre-populate the last 6 months so empty months appear
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, { incoming: 0, outgoing: 0 });
    }

    for (const tx of rows) {
      const d = tx.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      const val = parseFloat(tx.amountUsdc ?? '0');
      if (INFLOW_TYPES.has(tx.type)) {
        bucket.incoming += val;
      } else {
        bucket.outgoing += val;
      }
    }

    return Array.from(buckets.entries()).map(([month, b]) => ({
      month,
      incoming: b.incoming.toFixed(8),
      outgoing: b.outgoing.toFixed(8),
    }));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private applyFilters(
    qb: SelectQueryBuilder<Transaction>,
    query: QueryActivityDto,
  ): void {
    // Cursor pagination — items older than the cursor date
    if (query.after) {
      try {
        const decoded = Buffer.from(query.after, 'base64').toString('utf-8');
        const cursorDate = new Date(decoded);
        if (isNaN(cursorDate.getTime())) throw new Error('bad date');
        qb.andWhere('tx.createdAt < :cursor', { cursor: cursorDate });
      } catch {
        throw new BadRequestException('Invalid cursor');
      }
    }

    if (query.type) {
      qb.andWhere('tx.type = :type', { type: query.type });
    }

    if (query.status) {
      qb.andWhere('tx.status = :status', { status: query.status });
    }

    if (query.dateFrom) {
      qb.andWhere('tx.createdAt >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }

    if (query.dateTo) {
      qb.andWhere('tx.createdAt <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    if (query.search) {
      const term = `%${query.search}%`;
      qb.andWhere(
        '(tx.description ILIKE :term OR tx.counterpartyUsername ILIKE :term)',
        { term },
      );
    }
  }

  /**
   * Batch-loads public profile data for all counterparty usernames in one query.
   * Returns a map of username → CounterpartyDto.
   */
  private async batchLoadCounterparties(
    txs: Transaction[],
  ): Promise<Map<string, CounterpartyDto>> {
    const usernames = [
      ...new Set(
        txs
          .map((t) => t.counterpartyUsername)
          .filter((u): u is string => u !== null && u !== undefined),
      ),
    ];

    if (usernames.length === 0) return new Map();

    const users = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.username', 'u.displayName'])
      .where('u.username IN (:...usernames)', { usernames })
      .getMany();

    const map = new Map<string, CounterpartyDto>();
    for (const u of users) {
      map.set(u.username, { username: u.username, displayName: u.displayName });
    }
    return map;
  }

  private toFeedItem(
    tx: Transaction,
    counterpartyMap: Map<string, CounterpartyDto>,
  ): ActivityFeedItemDto {
    const item = new ActivityFeedItemDto();
    item.id = tx.id;
    item.type = tx.type;
    item.displayType = DISPLAY_TYPE_MAP[tx.type] ?? tx.type;
    item.amount = tx.amountUsdc ?? String(tx.amount ?? '0');
    // amountNgn: stored rate in metadata, fallback to 0
    const rate = parseFloat((tx.metadata?.['rateNgn'] as string | undefined) ?? '0');
    const amountNum = parseFloat(item.amount);
    item.amountNgn = (amountNum * rate).toFixed(2);
    item.fee = tx.fee;
    item.status = tx.status;
    item.counterparty = tx.counterpartyUsername
      ? (counterpartyMap.get(tx.counterpartyUsername) ?? {
          username: tx.counterpartyUsername,
          displayName: null,
        })
      : null;
    item.note = tx.description;
    item.createdAt = tx.createdAt;
    item.icon = ICON_MAP[tx.type] ?? 'circle';
    return item;
  }
}
