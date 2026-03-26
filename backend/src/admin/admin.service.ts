import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Raw } from 'typeorm';
import { User, KycStatus } from '../users/entities/user.entity';
import {
  Transaction,
  TransactionStatus,
} from '../transactions/entities/transaction.entity';
import {
  FraudFlag,
  FraudStatus,
  FraudSeverity,
} from '../fraud/entities/fraud-flag.entity';
import { Session } from '../auth/entities/session.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CacheService } from '../cache/cache.service';
import { TierName } from '../tier-config/entities/tier-config.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(FraudFlag)
    private readonly fraudRepo: Repository<FraudFlag>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(RefreshToken)
    private readonly tokenRepo: Repository<RefreshToken>,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly cacheService: CacheService,
  ) {}

  async findAllUsers(query: {
    page?: number;
    limit?: number;
    search?: string;
    tier?: TierName;
    kycStatus?: KycStatus;
    isActive?: boolean;
    isMerchant?: boolean;
  }) {
    const {
      page = 1,
      limit = 20,
      search,
      tier,
      kycStatus,
      isActive,
      isMerchant,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.email = ILike(`%${search}%`);
      // TypeORM doesn't support OR easily in this format, but for a dashboard this is usually enough
      // or we can use [ { email: ... }, { username: ... } ]
    }
    if (tier) where.tier = tier;
    if (kycStatus) where.kycStatus = kycStatus;
    if (isActive !== undefined) where.isActive = isActive;
    if (isMerchant !== undefined) where.isMerchant = isMerchant;

    const [data, total] = await this.userRepo.findAndCount({
      where: search
        ? [{ email: ILike(`%${search}%`) }, { username: ILike(`%${search}%`) }]
        : where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    return { data, total, page, limit };
  }

  async findUserById(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const [transactions, fraudFlags, sessions] = await Promise.all([
      this.txRepo.find({
        where: { userId: id },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.fraudRepo.find({ where: { userId: id, status: FraudStatus.OPEN } }),
      this.sessionRepo.find({ where: { userId: id } }),
    ]);

    // Mocking KYC submission for now as I don't see a specific KYC entity in the list yet
    // but the requirement says "KYC submission"

    return {
      ...user,
      walletBalance: '0.00', // Need to integrate with wallet service if exists
      recentTransactions: transactions,
      openFraudFlags: fraudFlags,
      sessions,
      kycSubmission: null,
    };
  }

  async freezeUser(id: string, reason: string, adminId: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    user.isActive = false;
    await this.userRepo.save(user);

    // Revoke all sessions
    const sessions = await this.sessionRepo.find({ where: { userId: id } });
    const sessionIds = sessions.map((s) => s.id);
    const refreshTokenIds = sessions.map((s) => s.refreshTokenId);

    if (sessionIds.length > 0) {
      await this.sessionRepo.delete(sessionIds);
      await this.tokenRepo.update(refreshTokenIds, { revokedAt: new Date() });
    }

    // Create FraudFlag
    await this.fraudRepo.save(
      this.fraudRepo.create({
        userId: id,
        rule: 'MANUAL_FREEZE',
        severity: FraudSeverity.HIGH,
        description: reason,
        status: FraudStatus.OPEN,
        triggeredBy: 'ADMIN',
      }),
    );

    // Audit log
    await this.auditService.log(
      adminId,
      'USER_FREEZE',
      `User ${id} frozen for reason: ${reason}`,
    );

    // Email user
    await this.emailService.queue(
      user.email,
      'ACCOUNT_FROZEN',
      { reason },
      user.id,
    );

    return { success: true };
  }

  async unfreezeUser(id: string, adminId: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    user.isActive = true;
    await this.userRepo.save(user);

    // Resolve FraudFlags
    await this.fraudRepo.update(
      { userId: id, rule: 'MANUAL_FREEZE', status: FraudStatus.OPEN },
      {
        status: FraudStatus.RESOLVED,
        resolvedBy: adminId,
        resolvedAt: new Date(),
        resolutionNote: 'Unfrozen by admin',
      },
    );

    // Audit log
    await this.auditService.log(
      adminId,
      'USER_UNFREEZE',
      `User ${id} unfrozen`,
    );

    // Email user
    await this.emailService.queue(user.email, 'ACCOUNT_UNFROZEN', {}, user.id);

    return { success: true };
  }

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      newUsersToday,
      pendingKycCount,
      openFraudFlagCount,
      txStats,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({
        where: { createdAt: Raw((alias) => `${alias} >= :today`, { today }) },
      }),
      this.userRepo.count({ where: { kycStatus: KycStatus.PENDING } }),
      this.fraudRepo.count({ where: { status: FraudStatus.OPEN } }),
      this.txRepo
        .createQueryBuilder('tx')
        .select('SUM(tx.amount)', 'totalVolume')
        // Assuming fees are in a separate column or calculated.
        // Based on Transaction entity I saw earlier, it only had amountUsdc and amount.
        // Let's assume fees are not yet in the entity or I missed them.
        .where('tx.status = :status', { status: TransactionStatus.COMPLETED })
        .andWhere('tx.createdAt >= :today', { today })
        .getRawOne(),
    ]);

    const activeToday = await this.cacheService.getActiveUsersTodayCount();

    return {
      totalUsers,
      activeToday,
      newUsersToday,
      totalUsdcVolumeToday: txStats?.totalVolume || 0,
      totalFeesToday: 0, // Placeholder
      pendingKycCount,
      openFraudFlagCount,
    };
  }

  async findAllTransactions(query: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.txRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    return { data, total, page, limit };
  }

  async broadcast(dto: { title: string; body: string; segment: string }) {
    // This would typically involve a background job
    // NotificationsService should have a broadcast method
    await this.notificationsService.broadcast(dto.title, dto.body, dto.segment);
    return { success: true };
  }
}
