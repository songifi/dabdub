import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  private boardKey(namespace: string): string {
    return `leaderboard:${namespace}`;
  }

  private top100Key(namespace: string): string {
    return `leaderboard:${namespace}:top100`;
  }

  /**
   * ZADD leaderboard:{namespace} GT score entityId
   * NX path: only adds if member does not exist.
   * GT path: only updates if new score is greater than existing.
   * Combined: insert with NX on first call, then use GT to never decrease.
   */
  async upsertScore(
    entityId: string,
    score: number,
    namespace: string,
  ): Promise<void> {
    const key = this.boardKey(namespace);

    // Check if member already exists
    const existing = await this.redis.zscore(key, entityId);

    if (existing === null) {
      // First time — add with NX
      await (this.redis as any).zadd(key, 'NX', score, entityId);
    } else {
      // Already exists — only update if new score is greater (GT)
      await (this.redis as any).zadd(key, 'GT', score, entityId);
    }

    await this.invalidateTop100IfNeeded(entityId, namespace);
  }

  /**
   * ZINCRBY leaderboard:{namespace} delta entityId
   */
  async incrementScore(
    entityId: string,
    delta: number,
    namespace: string,
  ): Promise<number> {
    const key = this.boardKey(namespace);
    const newScore = await this.redis.zincrby(key, delta, entityId);
    await this.invalidateTop100IfNeeded(entityId, namespace);
    return parseFloat(newScore);
  }

  /**
   * ZREVRANK is 0-indexed; return rank + 1 for 1-indexed, or null if not present.
   */
  async getRank(entityId: string, namespace: string): Promise<number | null> {
    const key = this.boardKey(namespace);
    const rank = await this.redis.zrevrank(key, entityId);
    if (rank === null) return null;
    return rank + 1;
  }

  /**
   * ZREVRANGEBYSCORE top N with scores → LeaderboardEntryDto[]
   */
  async getTopN(n: number, namespace: string): Promise<LeaderboardEntryDto[]> {
    const key = this.boardKey(namespace);
    // Returns [member, score, member, score, ...]
    const raw = await this.redis.zrevrange(key, 0, n - 1, 'WITHSCORES');
    return this.parseRangeWithScores(raw);
  }

  /**
   * Returns top 100 from cache if available, otherwise fetches and caches with 30s TTL.
   */
  async getTop100Cached(namespace: string): Promise<LeaderboardEntryDto[]> {
    const cacheKey = this.top100Key(namespace);
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as LeaderboardEntryDto[];
    }

    const entries = await this.getTopN(100, namespace);
    await this.redis.set(cacheKey, JSON.stringify(entries), 'EX', 30);
    return entries;
  }

  /**
   * Invalidate top100 cache if the entity is currently in the top 100.
   */
  private async invalidateTop100IfNeeded(
    entityId: string,
    namespace: string,
  ): Promise<void> {
    const rank = await this.getRank(entityId, namespace);
    if (rank !== null && rank <= 100) {
      await this.redis.del(this.top100Key(namespace));
    }
  }

  /**
   * Parse the flat [member, score, member, score, ...] array returned by ZREVRANGE WITHSCORES.
   */
  private parseRangeWithScores(raw: string[]): LeaderboardEntryDto[] {
    const entries: LeaderboardEntryDto[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const id = raw[i];
      const score = parseFloat(raw[i + 1]);
      entries.push({
        rank: i / 2 + 1,
        id,
        displayName: id, // displayName defaults to id; enrich downstream if a user lookup is available
        score,
      });
    }
    return entries;
  }
}
