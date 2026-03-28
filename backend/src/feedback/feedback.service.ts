import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { REDIS_CLIENT } from '../cache/redis.module';
import { FraudFlag, FraudStatus } from '../fraud/entities/fraud-flag.entity';
import {
  AdminFeedbackQueryDto,
} from './dto/admin-feedback-query.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import {
  FeedbackPromptTrigger,
} from './dto/should-prompt-query.dto';
import { Feedback, FeedbackType } from './entities/feedback.entity';
import {
  SupportTicket,
  SupportTicketStatus,
} from './entities/support-ticket.entity';
import {
  Transaction,
  TransactionStatus,
} from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';

const PROMPT_COOLDOWN_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class FeedbackService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,

    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,

    @InjectRepository(SupportTicket)
    private readonly supportTicketRepo: Repository<SupportTicket>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(FraudFlag)
    private readonly fraudRepo: Repository<FraudFlag>,
  ) {}

  async shouldPrompt(userId: string, trigger: FeedbackPromptTrigger): Promise<{
    shouldPrompt: boolean;
    reason?: string;
  }> {
    const cooldownKey = this.promptCooldownKey(userId, trigger);
    const onCooldown = await this.redis.get(cooldownKey);
    if (onCooldown) {
      return { shouldPrompt: false, reason: 'cooldown_active' };
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      return { shouldPrompt: false, reason: 'account_inactive' };
    }

    const openRestrictions = await this.fraudRepo.count({
      where: { userId, status: FraudStatus.OPEN },
    });
    if (openRestrictions > 0) {
      return { shouldPrompt: false, reason: 'account_restricted' };
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentCompletedTxCount = await this.txRepo.count({
      where: {
        userId,
        status: TransactionStatus.COMPLETED,
        createdAt: MoreThanOrEqual(thirtyDaysAgo),
      },
    });

    const hasRecentActivity =
      recentCompletedTxCount > 0 || user.updatedAt >= thirtyDaysAgo;

    if (!hasRecentActivity) {
      return { shouldPrompt: false, reason: 'inactive_30_days' };
    }

    if (trigger === FeedbackPromptTrigger.TRANSACTION_RATING) {
      const totalCompletedTx = await this.txRepo.count({
        where: {
          userId,
          status: TransactionStatus.COMPLETED,
        },
      });

      if (totalCompletedTx < 3) {
        return { shouldPrompt: false, reason: 'requires_three_transactions' };
      }
    }

    await this.redis.set(
      cooldownKey,
      '1',
      'EX',
      PROMPT_COOLDOWN_SECONDS,
    );

    return { shouldPrompt: true };
  }

  async submit(userId: string, dto: CreateFeedbackDto): Promise<{
    feedback: Feedback;
    supportTicket: SupportTicket | null;
  }> {
    this.validatePayload(dto);

    const requiresOutreach = this.shouldMarkForOutreach(dto);

    const feedback = await this.feedbackRepo.save(
      this.feedbackRepo.create({
        userId,
        type: dto.type,
        rating: dto.rating ?? null,
        npsScore: dto.npsScore ?? null,
        message: dto.message ?? null,
        context: dto.context ?? {},
        appVersion: dto.appVersion ?? null,
        platform: dto.platform ?? null,
        requiresOutreach,
      }),
    );

    let supportTicket: SupportTicket | null = null;
    if ((dto.rating ?? 5) <= 2) {
      supportTicket = await this.supportTicketRepo.save(
        this.supportTicketRepo.create({
          userId,
          feedbackId: feedback.id,
          title: 'Low feedback rating reported',
          description: dto.message ?? 'User submitted a low feedback rating (<=2).',
          status: SupportTicketStatus.OPEN,
        }),
      );
    }

    return { feedback, supportTicket };
  }

  async listFeedback(query: AdminFeedbackQueryDto): Promise<{
    data: Feedback[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.feedbackRepo.createQueryBuilder('feedback');

    if (query.type) {
      qb.andWhere('feedback.type = :type', { type: query.type });
    }

    if (query.maxRating !== undefined) {
      qb.andWhere('feedback.rating IS NOT NULL');
      qb.andWhere('feedback.rating <= :maxRating', {
        maxRating: query.maxRating,
      });
    }

    qb.orderBy('feedback.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async getAggregates(): Promise<{
    totalFeedback: number;
    ratingAverage: number;
    nps: number;
    promoters: number;
    detractors: number;
    passive: number;
    byType: Record<string, number>;
    outreachRequired: number;
  }> {
    const totalFeedback = await this.feedbackRepo.count();

    const ratingRow = await this.feedbackRepo
      .createQueryBuilder('feedback')
      .select('AVG(feedback.rating)', 'avgRating')
      .where('feedback.rating IS NOT NULL')
      .getRawOne<{ avgRating: string | null }>();

    const npsRows = await this.feedbackRepo
      .createQueryBuilder('feedback')
      .select('feedback.npsScore', 'score')
      .where('feedback.type = :type', { type: FeedbackType.NPS })
      .andWhere('feedback.npsScore IS NOT NULL')
      .getRawMany<{ score: string }>();

    const npsScores = npsRows
      .map((row: { score: string }) => Number(row.score))
      .filter((score: number) => Number.isFinite(score));

    const promoters = npsScores.filter((score: number) => score >= 9).length;
    const detractors = npsScores.filter((score: number) => score <= 6).length;
    const passive = npsScores.length - promoters - detractors;

    const nps =
      npsScores.length === 0
        ? 0
        : Math.round(((promoters - detractors) / npsScores.length) * 100);

    const typeRows = await this.feedbackRepo
      .createQueryBuilder('feedback')
      .select('feedback.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('feedback.type')
      .getRawMany<{ type: string; count: string }>();

    const byType: Record<string, number> = {};
    for (const row of typeRows) {
      byType[row.type] = Number(row.count);
    }

    const outreachRequired = await this.feedbackRepo.count({
      where: { requiresOutreach: true },
    });

    return {
      totalFeedback,
      ratingAverage: Number(ratingRow?.avgRating ?? 0),
      nps,
      promoters,
      detractors,
      passive,
      byType,
      outreachRequired,
    };
  }

  async getDetractors(query: Pick<AdminFeedbackQueryDto, 'page' | 'limit'>): Promise<{
    data: Feedback[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await this.feedbackRepo.findAndCount({
      where: { requiresOutreach: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  private validatePayload(dto: CreateFeedbackDto): void {
    if (dto.type === FeedbackType.NPS) {
      if (dto.npsScore === undefined) {
        throw new BadRequestException('npsScore is required for nps feedback');
      }
      return;
    }

    if (dto.rating === undefined) {
      throw new BadRequestException('rating is required for this feedback type');
    }
  }

  private shouldMarkForOutreach(dto: CreateFeedbackDto): boolean {
    const lowRating = dto.rating !== undefined && dto.rating <= 2;
    const detractorNps = dto.type === FeedbackType.NPS && (dto.npsScore ?? 10) <= 6;
    return lowRating || detractorNps;
  }

  private promptCooldownKey(userId: string, trigger: FeedbackPromptTrigger): string {
    return `feedback:prompt:cooldown:${userId}:${trigger}`;
  }
}
