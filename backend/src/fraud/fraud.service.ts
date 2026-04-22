import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  FraudFlag,
  FraudSeverity,
  FraudStatus,
} from './entities/fraud-flag.entity';
import { FraudContext } from './dto/fraud-context.dto';
import { QueryFlagsDto } from './dto/query-flags.dto';
import { ResolveFlagDto } from './dto/resolve-flag.dto';
import { RuleDependencies } from './rules/rule.interface';
import { VelocityTransferRule } from './rules/velocity-transfer.rule';
import { LargeFirstWithdrawalRule } from './rules/large-first-withdrawal.rule';
import { RapidAccountDrainRule } from './rules/rapid-account-drain.rule';
import { IpCountryMismatchRule } from './rules/ip-country-mismatch.rule';
import { NewDeviceLargeTransferRule } from './rules/new-device-large-transfer.rule';

export const FRAUD_QUEUE = 'fraud';
export const FRAUD_CHECK_JOB = 'fraud-check';

export interface FraudCheckPayload {
  userId: string;
  txId: string;
  context: FraudContext;
}

// Minimal interfaces so FraudService stays decoupled from concrete user/tx modules.
// Implement these in the calling module and pass via evaluate().
export interface UserFreezePort {
  freezeUser(userId: string): Promise<void>;
  unfreezeUser(userId: string): Promise<void>;
}

export interface AdminNotificationPort {
  notifyAdmin(subject: string, body: string): Promise<void>;
}

export interface AuditLogPort {
  log(adminId: string, action: string, detail: string): Promise<void>;
}

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  private readonly rules = [
    new VelocityTransferRule(),
    new LargeFirstWithdrawalRule(),
    new RapidAccountDrainRule(),
    new IpCountryMismatchRule(),
    new NewDeviceLargeTransferRule(),
  ];

  constructor(
    @InjectRepository(FraudFlag)
    private readonly fraudFlagRepo: Repository<FraudFlag>,

    @InjectQueue(FRAUD_QUEUE)
    private readonly fraudQueue: Queue<FraudCheckPayload>,
  ) {}

  /**
   * Enqueue a fire-and-forget fraud check job.
   * Call this after every confirmed transfer or withdrawal.
   */
  async enqueueCheck(payload: FraudCheckPayload): Promise<void> {
    await this.fraudQueue.add(FRAUD_CHECK_JOB, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  /**
   * Run all rules against the given context. Creates a FraudFlag for each match.
   * High-severity matches freeze the user and create an admin notification.
   */
  async evaluate(
    userId: string,
    txId: string,
    context: FraudContext,
    deps: RuleDependencies,
    ports: {
      userFreeze: UserFreezePort;
      adminNotification: AdminNotificationPort;
    },
  ): Promise<FraudFlag[]> {
    const createdFlags: FraudFlag[] = [];

    for (const rule of this.rules) {
      try {
        const match = await rule.evaluate(userId, txId, context, deps);
        if (!match) continue;

        const flag = this.fraudFlagRepo.create({
          userId,
          rule: match.rule,
          severity: match.severity,
          description: match.description,
          triggeredBy: txId,
          status: FraudStatus.OPEN,
          resolvedBy: null,
          resolvedAt: null,
          resolutionNote: null,
        });

        const saved = await this.fraudFlagRepo.save(flag);
        createdFlags.push(saved);

        this.logger.warn(
          `Fraud flag created: rule="${match.rule}" severity="${match.severity}" userId="${userId}" txId="${txId}"`,
        );

        if (match.severity === FraudSeverity.HIGH) {
          await this.handleHighSeverity(userId, saved, ports);
        }
      } catch (err) {
        this.logger.error(
          `Rule "${rule.constructor.name}" threw an error`,
          err,
        );
      }
    }

    return createdFlags;
  }

  private async handleHighSeverity(
    userId: string,
    flag: FraudFlag,
    ports: {
      userFreeze: UserFreezePort;
      adminNotification: AdminNotificationPort;
    },
  ): Promise<void> {
    try {
      await ports.userFreeze.freezeUser(userId);
      this.logger.warn(
        `User ${userId} frozen due to high-severity fraud flag ${flag.id}`,
      );
    } catch (err) {
      this.logger.error(`Failed to freeze user ${userId}`, err);
    }

    try {
      await ports.adminNotification.notifyAdmin(
        `High-severity fraud flag: ${flag.rule}`,
        `User ${userId} triggered rule "${flag.rule}". Flag ID: ${flag.id}. Description: ${flag.description}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send admin notification for flag ${flag.id}`,
        err,
      );
    }
  }

  async findFlags(
    query: QueryFlagsDto,
  ): Promise<{
    data: FraudFlag[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { severity, status, userId, page = 1, limit = 20 } = query;

    const where: FindOptionsWhere<FraudFlag> = {};
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [data, total] = await this.fraudFlagRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async resolveFlag(
    flagId: string,
    adminId: string,
    dto: ResolveFlagDto,
    ports: {
      userFreeze: UserFreezePort;
      auditLog: AuditLogPort;
    },
  ): Promise<FraudFlag> {
    const flag = await this.fraudFlagRepo.findOne({ where: { id: flagId } });
    if (!flag) throw new NotFoundException(`FraudFlag ${flagId} not found`);

    flag.status = dto.resolution as FraudStatus;
    flag.resolvedBy = adminId;
    flag.resolvedAt = new Date();
    flag.resolutionNote = dto.note ?? null;

    const saved = await this.fraudFlagRepo.save(flag);

    if (dto.resolution === FraudStatus.FALSE_POSITIVE) {
      try {
        await ports.userFreeze.unfreezeUser(flag.userId);
        this.logger.log(
          `User ${flag.userId} unfrozen after false_positive resolution of flag ${flagId}`,
        );
      } catch (err) {
        this.logger.error(`Failed to unfreeze user ${flag.userId}`, err);
      }
    }

    await ports.auditLog.log(
      adminId,
      `fraud_flag.${dto.resolution}`,
      `Flag ${flagId} resolved as "${dto.resolution}" by admin ${adminId}. Note: ${dto.note ?? 'none'}`,
    );

    return saved;
  }
}
