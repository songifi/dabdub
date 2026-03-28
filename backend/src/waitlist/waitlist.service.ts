import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  TooManyRequestsException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { customAlphabet } from 'nanoid';
import { REDIS_CLIENT } from '../cache/redis.module';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { RankResponseDto } from './dto/rank-response.dto';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';
import { EmailService } from '../email/email.service';
import { CheeseGateway } from '../ws/cheese.gateway';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

const LEADERBOARD_KEY = 'waitlist:leaderboard';
const LEADERBOARD_CACHE_KEY = 'waitlist:leaderboard:cache';
const LEADERBOARD_CACHE_TTL = 30;
const IP_RATE_KEY = (ip: string) => `waitlist:ip:${ip}:${new Date().toISOString().split('T')[0]}`;
const MAX_PER_IP = 3;
const BASE_POINTS = 100;
const REFERRAL_BONUS = 50;

// Common disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'guerrillamail.info', 'spam4.me', 'trashmail.com', 'trashmail.me',
  'dispostable.com', 'maildrop.cc', 'fakeinbox.com', 'mailnull.com',
  'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org', 'spamspot.com',
  'spamthis.co.uk', 'tempinbox.com', 'tempr.email', 'discard.email',
  'mailnesia.com', 'mailnull.com', 'spamfree24.org',
]);

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly repo: Repository<WaitlistEntry>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly emailService: EmailService,
    private readonly gateway: CheeseGateway,
  ) {
    this.frontendUrl = process.env['FRONTEND_URL'] ?? 'https://app.cheese.finance';
  }

  async join(dto: JoinWaitlistDto, ipAddress: string, fingerprint?: string): Promise<WaitlistEntry> {
    // 1. Disposable email check
    const domain = dto.email.split('@')[1]?.toLowerCase();
    if (domain && DISPOSABLE_DOMAINS.has(domain)) {
      throw new BadRequestException('Disposable email addresses are not allowed');
    }

    // 2. Duplicate email check
    const existing = await this.repo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('This email is already on the waitlist');
    }

    // 3. IP rate limit — max 3 per IP per day
    const ipKey = IP_RATE_KEY(ipAddress);
    const ipCount = await this.redis.incr(ipKey);
    if (ipCount === 1) {
      await this.redis.expire(ipKey, 86400); // 24h TTL
    }
    if (ipCount > MAX_PER_IP) {
      throw new TooManyRequestsException('Too many signups from this IP address');
    }

    // 4. Validate referral code if provided
    let referrer: WaitlistEntry | null = null;
    if (dto.referredByCode) {
      referrer = await this.repo.findOne({ where: { referralCode: dto.referredByCode } });
      if (!referrer) {
        throw new BadRequestException('Invalid referral code');
      }
    }

    // 5. Generate unique referral code
    let referralCode: string;
    do {
      referralCode = nanoid();
    } while (await this.repo.findOne({ where: { referralCode } }));

    // 6. Save entry
    const entry = this.repo.create({
      email: dto.email,
      name: dto.name,
      referralCode,
      referredByCode: dto.referredByCode ?? null,
      points: BASE_POINTS,
      ipAddress,
      fingerprint: fingerprint ?? null,
    });
    await this.repo.save(entry);

    // 7. Award referrer bonus
    if (referrer) {
      await this.repo.increment({ id: referrer.id }, 'points', REFERRAL_BONUS);
      referrer.points += REFERRAL_BONUS;
      await this.redis.zadd(LEADERBOARD_KEY, referrer.points, referrer.referralCode);
    }

    // 8. Add to Redis leaderboard sorted set
    await this.redis.zadd(LEADERBOARD_KEY, BASE_POINTS, referralCode);

    // 9. Invalidate leaderboard cache
    await this.redis.unlink(LEADERBOARD_CACHE_KEY);

    // 10. Emit WebSocket leaderboard update (broadcast to all)
    const leaderboard = await this.getLeaderboard();
    this.gateway['server']?.emit('waitlist:leaderboard', leaderboard);

    // 11. Send welcome email (fire-and-forget)
    const referralLink = `${this.frontendUrl}/join?ref=${referralCode}`;
    this.emailService
      .queue(dto.email, 'waitlist-welcome', { name: dto.name, referralLink, referralCode })
      .catch((err: Error) => this.logger.warn(`Welcome email failed: ${err.message}`));

    return entry;
  }

  async getRank(email: string): Promise<RankResponseDto> {
    const entry = await this.repo.findOne({ where: { email: email.toLowerCase() } });
    if (!entry) throw new NotFoundException('Email not found on waitlist');

    const totalEntries = await this.repo.count();

    // Rank = number of entries with strictly more points + 1
    const rank = await this.repo
      .createQueryBuilder('w')
      .where('w.points > :points', { points: entry.points })
      .getCount() + 1;

    return {
      rank,
      points: entry.points,
      referralCode: entry.referralCode,
      referralLink: `${this.frontendUrl}/join?ref=${entry.referralCode}`,
      totalEntries,
    };
  }

  async getLeaderboard(): Promise<LeaderboardEntryDto[]> {
    // Check cache
    const cached = await this.redis.get(LEADERBOARD_CACHE_KEY);
    if (cached) return JSON.parse(cached) as LeaderboardEntryDto[];

    // Top 100 from sorted set (highest score first)
    const raw = await this.redis.zrevrangebyscore(
      LEADERBOARD_KEY, '+inf', '-inf', 'WITHSCORES', 'LIMIT', 0, 100,
    );

    const result: LeaderboardEntryDto[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const code = raw[i]!;
      const points = parseInt(raw[i + 1]!, 10);
      const entry = await this.repo.findOne({ where: { referralCode: code } });
      if (entry) {
        result.push({ rank: result.length + 1, name: entry.name, points, referralCode: code });
      }
    }

    await this.redis.setex(LEADERBOARD_CACHE_KEY, LEADERBOARD_CACHE_TTL, JSON.stringify(result));
    return result;
  }

  async adminList(page: number, limit: number): Promise<{ data: WaitlistEntry[]; total: number }> {
    const [data, total] = await this.repo.findAndCount({
      order: { points: 'DESC', joinedAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }
}
