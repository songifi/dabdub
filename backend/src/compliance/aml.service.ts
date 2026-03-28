import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { User } from '../users/entities/user.entity';
import { Transaction, TransactionStatus } from '../transactions/entities/transaction.entity';
import {
  ComplianceEvent,
  ComplianceEventType,
  ComplianceEventSeverity,
  ComplianceEventStatus,
} from './entities/compliance-event.entity';
import { AuditService } from '../audit/audit.service';
import { ActorType } from '../audit/entities/audit-log.entity';
import { EmailService } from '../email/email.service';
import { Role } from '../rbac/rbac.types';

const AML_SINGLE_TX_THRESHOLD = 1000;
const AML_DAILY_THRESHOLD = 5000;
const AML_MONTHLY_THRESHOLD = 20000;

export interface CheckTransactionResult {
  events: ComplianceEvent[];
  autoFrozen: boolean;
}

export interface VerifyIdentityResult {
  verified: boolean;
  provider: string;
  raw?: Record<string, unknown>;
}

@Injectable()
export class AmlService {
  private readonly logger = new Logger(AmlService.name);

  constructor(
    @InjectRepository(ComplianceEvent)
    private readonly eventRepo: Repository<ComplianceEvent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Run AML checks for a transaction. Called async after a confirmed tx — never blocks.
   * Creates ComplianceEvents for each breach. Critical events auto-freeze the user.
   */
  async checkTransaction(
    userId: string,
    amount: number,
    txId: string | null = null,
  ): Promise<CheckTransactionResult> {
    const created: ComplianceEvent[] = [];
    let autoFrozen = false;

    // 1. Single transaction > $1000 → AML flag (high)
    if (amount > AML_SINGLE_TX_THRESHOLD) {
      const event = await this.createEvent({
        userId,
        txId,
        eventType: ComplianceEventType.AML_THRESHOLD,
        severity: ComplianceEventSeverity.HIGH,
        description: `Single transaction of $${amount.toFixed(2)} exceeds the $${AML_SINGLE_TX_THRESHOLD} AML threshold.`,
        metadata: { amount, threshold: AML_SINGLE_TX_THRESHOLD },
      });
      created.push(event);
    }

    // 2. Today's total > $5000 → daily volume breach (high)
    const dailyTotal = await this.getDailyVolume(userId);
    if (dailyTotal > AML_DAILY_THRESHOLD) {
      const event = await this.createEvent({
        userId,
        txId,
        eventType: ComplianceEventType.VOLUME_BREACH,
        severity: ComplianceEventSeverity.HIGH,
        description: `Daily transaction volume of $${dailyTotal.toFixed(2)} exceeds the $${AML_DAILY_THRESHOLD} daily limit.`,
        metadata: { dailyTotal, threshold: AML_DAILY_THRESHOLD },
      });
      created.push(event);
    }

    // 3. 30-day total > $20000 → monthly breach (critical → auto-freeze)
    const monthlyTotal = await this.getMonthlyVolume(userId);
    if (monthlyTotal > AML_MONTHLY_THRESHOLD) {
      const event = await this.createEvent({
        userId,
        txId,
        eventType: ComplianceEventType.VOLUME_BREACH,
        severity: ComplianceEventSeverity.CRITICAL,
        description: `30-day transaction volume of $${monthlyTotal.toFixed(2)} exceeds the $${AML_MONTHLY_THRESHOLD} monthly limit.`,
        metadata: { monthlyTotal, threshold: AML_MONTHLY_THRESHOLD },
      });
      created.push(event);

      // Auto-freeze + alert admins on critical
      autoFrozen = await this.handleCriticalEvent(userId, event);
    }

    return { events: created, autoFrozen };
  }

  /**
   * Verify identity via Prembly API.
   * Uses mock in dev (PREMBLY_MOCK=true) and real API in prod.
   */
  async verifyIdentity(
    userId: string,
    bvn: string,
    nin: string,
  ): Promise<VerifyIdentityResult> {
    const useMock =
      this.configService.get<string>('PREMBLY_MOCK') === 'true' ||
      this.configService.get<string>('NODE_ENV') === 'development';

    if (useMock) {
      this.logger.debug(`[MOCK] Identity verification for user ${userId}`);
      return { verified: true, provider: 'mock' };
    }

    const apiKey = this.configService.get<string>('PREMBLY_API_KEY');
    const appId = this.configService.get<string>('PREMBLY_APP_ID');

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(
          'https://api.prembly.com/identitypass/verification/bvn_with_face',
          { number: bvn, nin },
          {
            headers: {
              'x-api-key': apiKey,
              'app-id': appId,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const verified = data?.status === true || data?.verified === true;

      if (!verified) {
        await this.createEvent({
          userId,
          txId: null,
          eventType: ComplianceEventType.IDENTITY_UNVERIFIED,
          severity: ComplianceEventSeverity.MEDIUM,
          description: `Identity verification failed for user ${userId}. BVN/NIN mismatch or unverified.`,
          metadata: { bvnLast4: bvn.slice(-4), ninLast4: nin.slice(-4) },
        });
      }

      return { verified, provider: 'prembly', raw: data as Record<string, unknown> };
    } catch (err) {
      this.logger.error(`Prembly verification failed for user ${userId}: ${(err as Error).message}`);
      return { verified: false, provider: 'prembly' };
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async createEvent(params: {
    userId: string;
    txId: string | null;
    eventType: ComplianceEventType;
    severity: ComplianceEventSeverity;
    description: string;
    metadata: Record<string, unknown>;
  }): Promise<ComplianceEvent> {
    const event = await this.eventRepo.save(
      this.eventRepo.create({
        userId: params.userId,
        txId: params.txId,
        eventType: params.eventType,
        severity: params.severity,
        status: ComplianceEventStatus.OPEN,
        description: params.description,
        metadata: params.metadata,
        reviewedBy: null,
        resolvedBy: null,
        resolvedAt: null,
      }),
    );
    this.logger.warn(
      `ComplianceEvent created: type=${params.eventType} severity=${params.severity} userId=${params.userId}`,
    );
    return event;
  }

  private async handleCriticalEvent(
    userId: string,
    event: ComplianceEvent,
  ): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return false;

    if (user.isActive) {
      user.isActive = false;
      await this.userRepo.save(user);

      await this.auditService.log({
        actorId: 'system',
        actorType: ActorType.SYSTEM,
        action: 'compliance.auto_freeze',
        resourceType: 'user',
        resourceId: userId,
        after: { isActive: false, reason: 'critical_compliance_event', eventId: event.id },
      });

      this.logger.warn(`Auto-froze user ${userId} due to critical compliance event ${event.id}`);
    }

    // Alert all admins
    const admins = await this.userRepo.find({
      where: [
        { role: Role.Admin, isActive: true },
        { role: Role.SuperAdmin, isActive: true },
      ],
    });

    await Promise.allSettled(
      admins.map((admin) =>
        this.emailService.queue(
          admin.email,
          'compliance-critical-alert',
          {
            eventId: event.id,
            userId,
            eventType: event.eventType,
            description: event.description,
          },
          admin.id,
        ),
      ),
    );

    return true;
  }

  private async getDailyVolume(userId: string): Promise<number> {
    const start = this.startOfDay(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const txs = await this.txRepo.find({
      where: {
        userId,
        status: TransactionStatus.COMPLETED,
        createdAt: Between(start, end),
      },
    });
    return txs.reduce((sum, tx) => sum + parseFloat(tx.amountUsdc || '0'), 0);
  }

  private async getMonthlyVolume(userId: string): Promise<number> {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);

    const txs = await this.txRepo.find({
      where: {
        userId,
        status: TransactionStatus.COMPLETED,
        createdAt: Between(start, new Date()),
      },
    });
    return txs.reduce((sum, tx) => sum + parseFloat(tx.amountUsdc || '0'), 0);
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
