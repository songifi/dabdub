import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Queue } from 'bull';
import { Between, In, Repository } from 'typeorm';
import { EmailService } from '../email/email.service';
import {
  FraudFlag,
  FraudSeverity,
  FraudStatus,
} from '../fraud/entities/fraud-flag.entity';
import { KycSubmission, KycSubmissionStatus } from '../kyc/entities/kyc-submission.entity';
import { Role } from '../rbac/rbac.types';
import { TierConfig } from '../tier-config/entities/tier-config.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import {
  ComplianceEvent,
  ComplianceEventSeverity,
  ComplianceEventStatus,
  ComplianceEventType,
} from './entities/compliance-event.entity';
import {
  SarStatus,
  SuspiciousActivityReport,
} from './entities/suspicious-activity-report.entity';
import type { CreateSarDto } from './dto/create-sar.dto';
import type { QuerySarsDto } from './dto/query-sars.dto';
import type { QueryComplianceEventsDto } from './dto/query-compliance-events.dto';

export const COMPLIANCE_QUEUE = 'compliance';
export const STRUCTURING_DETECT_JOB = 'detect-structuring';
export const CHECK_TRANSACTION_JOB = 'check-transaction';

export interface CheckTransactionJobData {
  userId: string;
  amount: number;
  txId: string | null;
}

type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class ComplianceDashboardService {
  private readonly logger = new Logger(ComplianceDashboardService.name);

  constructor(
    @InjectRepository(ComplianceEvent)
    private readonly complianceEventRepo: Repository<ComplianceEvent>,
    @InjectRepository(SuspiciousActivityReport)
    private readonly sarRepo: Repository<SuspiciousActivityReport>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(FraudFlag)
    private readonly fraudRepo: Repository<FraudFlag>,
    @InjectRepository(KycSubmission)
    private readonly kycRepo: Repository<KycSubmission>,
    @InjectRepository(TierConfig)
    private readonly tierRepo: Repository<TierConfig>,
    private readonly emailService: EmailService,
    @InjectQueue(COMPLIANCE_QUEUE)
    private readonly complianceQueue: Queue,
  ) {}

  async getSummary(): Promise<{
    openAmlEvents: number;
    criticalEvents: number;
    frozenAccounts: number;
    pendingKycCount: number;
    totalVolumeToday: number;
    transactionsAbove1000Today: number;
    usersApproachingMonthlyLimit: number;
  }> {
    const today = this.startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = this.startOfMonth(new Date());

    const [
      openEvents,
      frozenAccounts,
      pendingKycs,
      todaysTransactions,
      users,
      tiers,
      monthlyTransfers,
    ] = await Promise.all([
      this.complianceEventRepo.find({
        where: { status: ComplianceEventStatus.OPEN },
      }),
      this.userRepo.count({ where: { isActive: false } }),
      this.kycRepo.count({
        where: {
          status: In([
            KycSubmissionStatus.PENDING,
            KycSubmissionStatus.UNDER_REVIEW,
          ]),
        },
      }),
      this.txRepo.find({
        where: {
          status: TransactionStatus.COMPLETED,
          createdAt: Between(today, tomorrow),
        },
      }),
      this.userRepo.find(),
      this.tierRepo.find({ where: { isActive: true } as any }),
      this.txRepo.find({
        where: {
          status: TransactionStatus.COMPLETED,
          type: TransactionType.TRANSFER_OUT,
          createdAt: Between(monthStart, tomorrow),
        },
      }),
    ]);

    const tierByName = new Map(tiers.map((tier) => [tier.tier, tier]));
    const monthlyVolumeByUser = new Map<string, number>();

    for (const tx of monthlyTransfers) {
      monthlyVolumeByUser.set(
        tx.userId,
        (monthlyVolumeByUser.get(tx.userId) ?? 0) + this.toAmount(tx.amountUsdc),
      );
    }

    const usersApproachingMonthlyLimit = users.filter((user) => {
      const tier = tierByName.get(user.tier);
      if (!tier) return false;

      const monthlyLimit = parseFloat(tier.monthlyTransferLimitUsdc);
      const used = monthlyVolumeByUser.get(user.id) ?? 0;
      return monthlyLimit > 0 && used >= monthlyLimit * 0.8;
    }).length;

    return {
      openAmlEvents: openEvents.length,
      criticalEvents: openEvents.filter(
        (event) => event.severity === ComplianceEventSeverity.CRITICAL,
      ).length,
      frozenAccounts,
      pendingKycCount: pendingKycs,
      totalVolumeToday: todaysTransactions.reduce(
        (sum, tx) => sum + this.toAmount(tx.amountUsdc),
        0,
      ),
      transactionsAbove1000Today: todaysTransactions.filter(
        (tx) => this.toAmount(tx.amountUsdc) >= 1000,
      ).length,
      usersApproachingMonthlyLimit,
    };
  }

  async getHighRiskUsers(
    page: number = 1,
    limit: number = 20,
  ): Promise<Paginated<Record<string, unknown>>> {
    const [openEvents, highFraudFlags] = await Promise.all([
      this.complianceEventRepo.find({
        where: { status: ComplianceEventStatus.OPEN },
      }),
      this.fraudRepo.find({
        where: {
          status: FraudStatus.OPEN,
          severity: FraudSeverity.HIGH,
        },
      }),
    ]);

    const riskCounts = new Map<
      string,
      { complianceEvents: number; highFraudFlags: number }
    >();

    for (const event of openEvents) {
      const current = riskCounts.get(event.userId) ?? {
        complianceEvents: 0,
        highFraudFlags: 0,
      };
      current.complianceEvents += 1;
      riskCounts.set(event.userId, current);
    }

    for (const flag of highFraudFlags) {
      const current = riskCounts.get(flag.userId) ?? {
        complianceEvents: 0,
        highFraudFlags: 0,
      };
      current.highFraudFlags += 1;
      riskCounts.set(flag.userId, current);
    }

    const riskyIds = [...riskCounts.entries()]
      .filter(
        ([, counts]) =>
          counts.complianceEvents >= 2 || counts.highFraudFlags >= 1,
      )
      .map(([userId]) => userId);

    const users = riskyIds.length
      ? await this.userRepo.find({ where: { id: In(riskyIds) } })
      : [];

    const ranked = users
      .map((user) => {
        const counts = riskCounts.get(user.id)!;
        return {
          userId: user.id,
          email: user.email,
          username: user.username,
          isActive: user.isActive,
          complianceEventCount: counts.complianceEvents,
          highFraudFlagCount: counts.highFraudFlags,
          riskScore:
            counts.complianceEvents * 40 +
            counts.highFraudFlags * 60 +
            (user.isActive ? 0 : 20),
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);

    const start = (page - 1) * limit;
    return {
      data: ranked.slice(start, start + limit),
      total: ranked.length,
      page,
      limit,
    };
  }

  async getTransactionPatterns(userId: string): Promise<{
    hourlyHeatmap: Array<{ hour: number; count: number }>;
    topRecipients: Array<{ recipient: string; count: number; volume: number }>;
    averageTransactionSize: number;
    volumeTrend: Array<{ date: string; volume: number }>;
  }> {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 30);

    const transactions = await this.txRepo.find({
      where: {
        userId,
        status: TransactionStatus.COMPLETED,
        createdAt: Between(start, end),
      },
      order: { createdAt: 'ASC' },
    });

    const hourlyHeatmap = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
    }));
    const recipients = new Map<string, { count: number; volume: number }>();
    const trend = new Map<string, number>();

    for (const tx of transactions) {
      const amount = this.toAmount(tx.amountUsdc);
      hourlyHeatmap[tx.createdAt.getHours()].count += 1;

      if (tx.counterpartyUsername) {
        const current = recipients.get(tx.counterpartyUsername) ?? {
          count: 0,
          volume: 0,
        };
        current.count += 1;
        current.volume += amount;
        recipients.set(tx.counterpartyUsername, current);
      }

      const dayKey = tx.createdAt.toISOString().slice(0, 10);
      trend.set(dayKey, (trend.get(dayKey) ?? 0) + amount);
    }

    return {
      hourlyHeatmap,
      topRecipients: [...recipients.entries()]
        .map(([recipient, stats]) => ({ recipient, ...stats }))
        .sort((a, b) => {
          if (b.volume === a.volume) return b.count - a.count;
          return b.volume - a.volume;
        })
        .slice(0, 5),
      averageTransactionSize:
        transactions.length === 0
          ? 0
          : transactions.reduce(
              (sum, tx) => sum + this.toAmount(tx.amountUsdc),
              0,
            ) / transactions.length,
      volumeTrend: this.lastNDays(7).map((date) => ({
        date,
        volume: trend.get(date) ?? 0,
      })),
    };
  }

  async createSarDraft(
    adminId: string,
    dto: CreateSarDto,
  ): Promise<SuspiciousActivityReport> {
    return this.sarRepo.save(
      this.sarRepo.create({
        userId: dto.userId,
        generatedBy: adminId,
        reportType: dto.reportType,
        narrative: dto.narrative,
        status: SarStatus.DRAFT,
        filedAt: null,
      }),
    );
  }

  async listSars(
    query: QuerySarsDto,
  ): Promise<Paginated<SuspiciousActivityReport>> {
    const { page = 1, limit = 20, status, userId } = query;
    const where: Record<string, unknown> = {};
    if (status) where['status'] = status;
    if (userId) where['userId'] = userId;

    const [data, total] = await this.sarRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async submitSar(
    id: string,
    adminId: string,
  ): Promise<SuspiciousActivityReport> {
    const sar = await this.sarRepo.findOne({ where: { id } });
    if (!sar) {
      throw new NotFoundException('Suspicious activity report not found');
    }

    sar.status = SarStatus.SUBMITTED;
    const saved = await this.sarRepo.save(sar);

    const superAdmins = await this.userRepo.find({
      where: { role: Role.SuperAdmin, isActive: true },
    });

    await Promise.all(
      superAdmins.map((admin) =>
        this.emailService.queue(
          admin.email,
          'sar-submitted',
          {
            sarId: saved.id,
            userId: saved.userId,
            submittedBy: adminId,
            reportType: saved.reportType,
          },
          admin.id,
        ),
      ),
    );

    return saved;
  }

  // ── Admin compliance event endpoints ──────────────────────────────────────

  async listEvents(
    query: QueryComplianceEventsDto,
  ): Promise<Paginated<ComplianceEvent>> {
    const { page = 1, limit = 20, status, eventType, severity, userId } = query;
    const where: Record<string, unknown> = {};
    if (status) where['status'] = status;
    if (eventType) where['eventType'] = eventType;
    if (severity) where['severity'] = severity;
    if (userId) where['userId'] = userId;

    const [data, total] = await this.complianceEventRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async clearEvent(
    id: string,
    adminId: string,
    note: string,
  ): Promise<ComplianceEvent> {
    const event = await this.complianceEventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException(`ComplianceEvent ${id} not found`);

    event.status = ComplianceEventStatus.CLEARED;
    event.reviewedBy = adminId;
    event.resolvedBy = adminId;
    event.resolvedAt = new Date();
    event.metadata = { ...event.metadata, clearNote: note };
    const saved = await this.complianceEventRepo.save(event);

    // If user was auto-frozen due to this event, unfreeze them
    const user = await this.userRepo.findOne({ where: { id: event.userId } });
    if (user && !user.isActive) {
      const otherCritical = await this.complianceEventRepo.findOne({
        where: {
          userId: event.userId,
          severity: ComplianceEventSeverity.CRITICAL,
          status: ComplianceEventStatus.OPEN,
        },
      });
      if (!otherCritical) {
        user.isActive = true;
        await this.userRepo.save(user);
        this.logger.log(`Unfroze user ${event.userId} after compliance event ${id} cleared`);
      }
    }

    return saved;
  }

  async escalateEvent(
    id: string,
    adminId: string,
  ): Promise<ComplianceEvent> {
    const event = await this.complianceEventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException(`ComplianceEvent ${id} not found`);

    event.status = ComplianceEventStatus.ESCALATED;
    event.reviewedBy = adminId;
    const saved = await this.complianceEventRepo.save(event);

    // Notify SuperAdmins
    const superAdmins = await this.userRepo.find({
      where: { role: Role.SuperAdmin, isActive: true },
    });
    await Promise.allSettled(
      superAdmins.map((admin) =>
        this.emailService.queue(
          admin.email,
          'compliance-event-escalated',
          {
            eventId: id,
            userId: event.userId,
            eventType: event.eventType,
            severity: event.severity,
            escalatedBy: adminId,
          },
          admin.id,
        ),
      ),
    );

    return saved;
  }

  async getUserComplianceSummary(userId: string): Promise<{
    monthlyVolume: number;
    openEventCount: number;
    kycStatus: string;
    tier: string;
  }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const monthStart = this.startOfMonth(new Date());
    const now = new Date();

    const [openEventCount, monthlyTxs, latestKyc] = await Promise.all([
      this.complianceEventRepo.count({
        where: { userId, status: ComplianceEventStatus.OPEN },
      }),
      this.txRepo.find({
        where: {
          userId,
          status: TransactionStatus.COMPLETED,
          createdAt: Between(monthStart, now),
        },
      }),
      this.kycRepo.findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
    ]);

    const monthlyVolume = monthlyTxs.reduce(
      (sum, tx) => sum + this.toAmount(tx.amountUsdc),
      0,
    );

    return {
      monthlyVolume,
      openEventCount,
      kycStatus: latestKyc?.status ?? user.kycStatus,
      tier: user.tier,
    };
  }

  async enqueueDailyStructuringDetection(): Promise<void> {
    await this.complianceQueue.add(
      STRUCTURING_DETECT_JOB,
      {},
      {
        repeat: { cron: '0 1 * * *' },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async detectStructuringForYesterday(): Promise<ComplianceEvent[]> {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return this.detectStructuringForDate(date);
  }

  async detectStructuringForDate(date: Date): Promise<ComplianceEvent[]> {
    const start = this.startOfDay(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const dateKey = start.toISOString().slice(0, 10);

    const transactions = await this.txRepo.find({
      where: {
        status: TransactionStatus.COMPLETED,
        createdAt: Between(start, end),
      },
    });
    const existingEvents = await this.complianceEventRepo.find({
      where: {
        eventType: ComplianceEventType.STRUCTURING,
        createdAt: Between(start, end),
      },
    });

    const totalsByUser = new Map<string, number>();
    const suspiciousByUser = new Map<string, Transaction[]>();

    for (const tx of transactions) {
      const amount = this.toAmount(tx.amountUsdc);
      totalsByUser.set(tx.userId, (totalsByUser.get(tx.userId) ?? 0) + amount);

      if (amount >= 900 && amount < 1000) {
        const current = suspiciousByUser.get(tx.userId) ?? [];
        current.push(tx);
        suspiciousByUser.set(tx.userId, current);
      }
    }

    const existingUserIds = new Set(existingEvents.map((event) => event.userId));
    const created: ComplianceEvent[] = [];

    for (const [userId, suspiciousTransactions] of suspiciousByUser.entries()) {
      if ((totalsByUser.get(userId) ?? 0) <= 500) {
        continue;
      }
      if (suspiciousTransactions.length < 3 || existingUserIds.has(userId)) {
        continue;
      }

      const event = await this.complianceEventRepo.save(
        this.complianceEventRepo.create({
          userId,
          eventType: ComplianceEventType.STRUCTURING,
          severity: ComplianceEventSeverity.HIGH,
          status: ComplianceEventStatus.OPEN,
          description: `Detected possible structuring from ${suspiciousTransactions.length} transactions just below the $1000 threshold on ${dateKey}.`,
          metadata: {
            date: dateKey,
            transactionIds: suspiciousTransactions.map((tx) => tx.id),
            amounts: suspiciousTransactions.map((tx) =>
              this.toAmount(tx.amountUsdc),
            ),
          },
          resolvedBy: null,
          resolvedAt: null,
        }),
      );

      this.logger.warn(
        `Structuring event created for userId=${userId} date=${dateKey}`,
      );
      created.push(event);
    }

    return created;
  }

  private toAmount(raw: string | number): number {
    return typeof raw === 'number' ? raw : parseFloat(raw || '0');
  }

  private startOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private lastNDays(days: number): string[] {
    return Array.from({ length: days }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - index - 1));
      return date.toISOString().slice(0, 10);
    });
  }
}
