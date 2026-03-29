import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { User, KycStatus } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { PayLink } from '../paylink/entities/pay-link.entity';
import { PublicProfileDto } from '../profile/dto/public-profile.dto';
import { ActivityFeedItemDto, CounterpartyDto } from '../activity/dto/activity-feed.dto';
import { REDIS_CLIENT } from '../cache/redis.module';
import { SearchResultsDto, SearchType } from './dto/search.dto';
import { TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';

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
  [TransactionType.VIRTUAL_CARD_CREATION]: 'Card Created',
  [TransactionType.VIRTUAL_CARD_FUND]: 'Card Funded',
  [TransactionType.VIRTUAL_CARD_SPEND]: 'Card Spend',
};

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
  [TransactionType.VIRTUAL_CARD_CREATION]: 'credit-card',
  [TransactionType.VIRTUAL_CARD_FUND]: 'credit-card',
  [TransactionType.VIRTUAL_CARD_SPEND]: 'credit-card',
};

const SEARCH_ANALYTICS_KEY = 'search:queries';
const ALL_TYPES: SearchType[] = ['users', 'transactions', 'paylinks'];

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    @InjectRepository(PayLink)
    private readonly payLinkRepo: Repository<PayLink>,

    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async search(
    userId: string,
    query: string,
    types: SearchType[] = ALL_TYPES,
  ): Promise<SearchResultsDto> {
    if (query.length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }

    // Log anonymized query for analytics (fire-and-forget)
    this.redis
      .lpush(SEARCH_ANALYTICS_KEY, query)
      .catch(() => {});

    const runUsers = types.includes('users');
    const runTx = types.includes('transactions');
    const runPaylinks = types.includes('paylinks');

    const [users, transactions, paylinks] = await Promise.all([
      runUsers ? this.searchUsers(userId, query) : Promise.resolve([]),
      runTx ? this.searchTransactions(userId, query) : Promise.resolve([]),
      runPaylinks ? this.searchPayLinks(userId, query) : Promise.resolve([]),
    ]);

    return {
      users,
      transactions,
      paylinks,
      query,
      totalResults: users.length + transactions.length + paylinks.length,
    };
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  private async searchUsers(userId: string, query: string): Promise<PublicProfileDto[]> {
    const term = `%${query}%`;

    const [results, contactUsernames] = await Promise.all([
      this.userRepo
        .createQueryBuilder('u')
        .where('u.id != :userId', { userId })
        .andWhere('u.isActive = true')
        .andWhere(
          '(u.username ILIKE :term OR u.displayName ILIKE :term)',
          { term },
        )
        .select([
          'u.id', 'u.username', 'u.displayName', 'u.avatarKey',
          'u.bio', 'u.tier', 'u.isMerchant', 'u.kycStatus', 'u.createdAt',
        ])
        .take(20)
        .getMany(),

      this.getContactUsernames(userId),
    ]);

    const contactSet = new Set(contactUsernames);

    // Boost contacts to top
    const contacts: PublicProfileDto[] = [];
    const others: PublicProfileDto[] = [];

    for (const u of results) {
      const dto = this.toPublicProfileDto(u);
      if (contactSet.has(u.username)) {
        contacts.push(dto);
      } else {
        others.push(dto);
      }
    }

    return [...contacts, ...others].slice(0, 5);
  }

  /**
   * Derives "contacts" from users the current user has transacted with
   * (sent or received transfers).
   */
  private async getContactUsernames(userId: string): Promise<string[]> {
    const rows = await this.txRepo
      .createQueryBuilder('tx')
      .select('DISTINCT tx.counterpartyUsername', 'username')
      .where('tx.userId = :userId', { userId })
      .andWhere('tx.counterpartyUsername IS NOT NULL')
      .getRawMany<{ username: string }>();

    return rows.map((r) => r.username);
  }

  // ── Transactions ──────────────────────────────────────────────────────────

  private async searchTransactions(
    userId: string,
    query: string,
  ): Promise<ActivityFeedItemDto[]> {
    const term = `%${query}%`;

    const txs = await this.txRepo
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId })
      .andWhere(
        '(tx.description ILIKE :term OR tx.counterpartyUsername ILIKE :term OR tx.reference ILIKE :term)',
        { term },
      )
      .orderBy('tx.createdAt', 'DESC')
      .take(5)
      .getMany();

    // Batch-load counterparty display names
    const usernames = [
      ...new Set(
        txs
          .map((t) => t.counterpartyUsername)
          .filter((u): u is string => u !== null),
      ),
    ];

    const counterpartyMap = new Map<string, CounterpartyDto>();
    if (usernames.length > 0) {
      const users = await this.userRepo
        .createQueryBuilder('u')
        .select(['u.username', 'u.displayName'])
        .where('u.username IN (:...usernames)', { usernames })
        .getMany();
      for (const u of users) {
        counterpartyMap.set(u.username, { username: u.username, displayName: u.displayName });
      }
    }

    return txs.map((tx) => this.toActivityFeedItem(tx, counterpartyMap));
  }

  // ── PayLinks ──────────────────────────────────────────────────────────────

  private async searchPayLinks(userId: string, query: string): Promise<PayLink[]> {
    const term = `%${query}%`;

    return this.payLinkRepo
      .createQueryBuilder('p')
      .where('p.creatorUserId = :userId', { userId })
      .andWhere('(p.tokenId ILIKE :term OR p.note ILIKE :term)', { term })
      .orderBy('p.createdAt', 'DESC')
      .take(5)
      .getMany();
  }

  // ── Mappers ───────────────────────────────────────────────────────────────

  private toPublicProfileDto(u: User): PublicProfileDto {
    return {
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarKey ? `https://pub-r2.dabdub.com/${u.avatarKey}` : null,
      bio: u.bio,
      tier: u.tier,
      isMerchant: u.isMerchant,
      isVerified: u.kycStatus === KycStatus.APPROVED,
      joinedAt: u.createdAt,
    };
  }

  private toActivityFeedItem(
    tx: Transaction,
    counterpartyMap: Map<string, CounterpartyDto>,
  ): ActivityFeedItemDto {
    const item = new ActivityFeedItemDto();
    item.id = tx.id;
    item.type = tx.type;
    item.displayType = DISPLAY_TYPE_MAP[tx.type] ?? tx.type;
    item.amount = tx.amountUsdc ?? String(tx.amount ?? '0');
    const rate = parseFloat((tx.metadata?.['rateNgn'] as string | undefined) ?? '0');
    item.amountNgn = (parseFloat(item.amount) * rate).toFixed(2);
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
