import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, KycStatus } from '../../users/entities/user.entity';
import {
  LoginHistory,
  LoginStatus,
  LoginFailureReason,
  SecurityAlert,
  SecurityAlertType,
  TrustedDevice,
} from '../entities';
import type {
  SecurityOverviewDto,
  LoginHistoryDto,
  SecurityAlertDto,
  TrustedDeviceDto,
} from '../dto/security.dto';
import { Session } from '../../auth/entities/session.entity';

/**
 * SecurityService
 *
 * Manages account security features:
 * - Security score calculation
 * - Login history tracking
 * - Security alerts for suspicious activity
 * - Trusted device management
 */
@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(LoginHistory)
    private readonly loginHistoryRepo: Repository<LoginHistory>,

    @InjectRepository(SecurityAlert)
    private readonly alertRepo: Repository<SecurityAlert>,

    @InjectRepository(TrustedDevice)
    private readonly deviceRepo: Repository<TrustedDevice>,

    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
  ) {}

  /**
   * Calculate security score (0-100) based on completed security steps.
   *
   * Scoring:
   * - Email verified: +20
   * - Phone verified: +20
   * - PIN set: +20
   * - Passkey registered: +20
   * - KYC approved: +20
   */
  async getSecurityScore(userId: string): Promise<number> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return 0;
    }

    let score = 0;

    // Email verified: +20
    if (user.emailVerified) {
      score += 20;
    }

    // Phone verified: +20
    if (user.phoneVerified && user.phone) {
      score += 20;
    }

    // PIN set: +20
    if (user.pinHash) {
      score += 20;
    }

    // Passkey registered: +20
    if (user.passkeyId) {
      score += 20;
    }

    // KYC approved: +20
    if (user.kycStatus === KycStatus.APPROVED) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  /**
   * Get comprehensive security overview for user dashboard
   */
  async getOverview(userId: string): Promise<SecurityOverviewDto> {
    const [user, activeSessions, lastLogin, recentAlerts, trustedDevicesCount] =
      await Promise.all([
        this.userRepo.findOne({ where: { id: userId } }),
        this.sessionRepo.count({ where: { userId, revokedAt: null } }),
        this.loginHistoryRepo.findOne({
          where: { userId, status: LoginStatus.SUCCESS },
          order: { createdAt: 'DESC' },
        }),
        this.alertRepo.find({
          where: { userId, isRead: false },
          order: { createdAt: 'DESC' },
          take: 5,
        }),
        this.deviceRepo.count({ where: { userId } }),
      ]);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const securityScore = await this.getSecurityScore(userId);

    return {
      securityScore,
      emailVerified: user.emailVerified || false,
      phoneVerified: user.phoneVerified || false,
      hasPin: !!user.pinHash,
      hasPasskey: !!user.passkeyId,
      kycStatus: user.kycStatus,
      activeSessions,
      trustedDevices: trustedDevicesCount,
      lastLoginAt: lastLogin?.createdAt?.toISOString(),
      lastLoginIp: lastLogin?.ipAddress,
      recentAlerts: recentAlerts.map((alert) => this.mapAlertToDto(alert)),
    };
  }

  /**
   * Record a login attempt (success or failure)
   */
  async recordLoginAttempt(
    userId: string,
    ipAddress: string | null,
    userAgent: string | null,
    status: LoginStatus,
    failureReason: LoginFailureReason | null = null,
  ): Promise<LoginHistory> {
    const history = this.loginHistoryRepo.create({
      userId,
      ipAddress,
      userAgent,
      status,
      failureReason,
    });

    await this.loginHistoryRepo.save(history);

    // Trigger security checks for successful logins
    if (status === LoginStatus.SUCCESS) {
      await this.checkNewDeviceLogin(userId, ipAddress, userAgent);
    }

    return history;
  }

  /**
   * Check if login is from a new device and create alert if so
   */
  private async checkNewDeviceLogin(
    userId: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<void> {
    if (!ipAddress || !userAgent) {
      return;
    }

    // Check if this device has logged in before
    const existingDevice = await this.deviceRepo.findOne({
      where: {
        userId,
        ipAddress,
        userAgent,
      },
    });

    if (!existingDevice) {
      // New device detected
      await this.createAlert(
        userId,
        SecurityAlertType.NEW_DEVICE,
        `New device login from ${ipAddress}`,
      );
    }
  }

  /**
   * Create a security alert
   */
  async createAlert(userId: string, type: SecurityAlertType, message: string): Promise<void> {
    const alert = this.alertRepo.create({
      userId,
      type,
      message,
    });

    await this.alertRepo.save(alert);
    this.logger.log(`Security alert created for user ${userId}: ${message}`);
  }

  /**
   * Create PIN failed attempt alert (when 3+ failures)
   */
  async checkPinFailures(userId: string): Promise<void> {
    // This would be called from PIN service after multiple failures
    // For now, placeholder for integration
    await this.createAlert(
      userId,
      SecurityAlertType.PIN_ATTEMPTS,
      'Multiple PIN verification failures detected',
    );
  }

  /**
   * Create large withdrawal alert
   */
  async checkLargeWithdrawal(userId: string, amount: number): Promise<void> {
    // Threshold can be configurable
    const withdrawalThreshold = 10000; // Example: 10k USD equivalent

    if (amount > withdrawalThreshold) {
      await this.createAlert(
        userId,
        SecurityAlertType.LARGE_WITHDRAWAL,
        `Large withdrawal initiated: ${amount} USD`,
      );
    }
  }

  /**
   * Get paginated login history (last 30 days)
   */
  async getLoginHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: LoginHistoryDto[]; total: number; page: number; limit: number }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [logins, total] = await this.loginHistoryRepo.findAndCount({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: logins.map((login) => this.mapLoginToDto(login)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get unread security alerts
   */
  async getUnreadAlerts(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: SecurityAlertDto[]; total: number; page: number; limit: number }> {
    const [alerts, total] = await this.alertRepo.findAndCount({
      where: { userId, isRead: false },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: alerts.map((alert) => this.mapAlertToDto(alert)),
      total,
      page,
      limit,
    };
  }

  /**
   * Mark alert as read
   */
  async markAlertAsRead(userId: string, alertId: string): Promise<void> {
    await this.alertRepo.update(
      { id: alertId, userId },
      { isRead: true },
    );
  }

  /**
   * Get trusted devices
   */
  async getTrustedDevices(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: TrustedDeviceDto[]; total: number; page: number; limit: number }> {
    const [devices, total] = await this.deviceRepo.findAndCount({
      where: { userId },
      order: { lastSeenAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: devices.map((device) => this.mapDeviceToDto(device)),
      total,
      page,
      limit,
    };
  }

  /**
   * Revoke a trusted device
   */
  async revokeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    await this.deviceRepo.delete({ id: deviceId, userId });
  }

  /**
   * Register or update a trusted device
   */
  async registerDevice(
    userId: string,
    deviceHash: string,
    deviceName: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<void> {
    let device = await this.deviceRepo.findOne({
      where: { userId, deviceHash },
    });

    if (device) {
      // Update existing device
      device.lastSeenAt = new Date();
      device.ipAddress = ipAddress;
      device.userAgent = userAgent;
      await this.deviceRepo.save(device);
    } else {
      // Create new device
      device = this.deviceRepo.create({
        userId,
        deviceHash,
        deviceName,
        ipAddress,
        userAgent,
        lastSeenAt: new Date(),
      });
      await this.deviceRepo.save(device);
    }
  }

  // ── Mappers ──────────────────────────────────────────

  private mapLoginToDto(login: LoginHistory): LoginHistoryDto {
    return {
      id: login.id,
      ipAddress: login.ipAddress || undefined,
      location: login.location || undefined,
      status: login.status,
      createdAt: login.createdAt.toISOString(),
    };
  }

  private mapAlertToDto(alert: SecurityAlert): SecurityAlertDto {
    return {
      id: alert.id,
      type: alert.type,
      message: alert.message,
      isRead: alert.isRead,
      createdAt: alert.createdAt.toISOString(),
    };
  }

  private mapDeviceToDto(device: TrustedDevice): TrustedDeviceDto {
    return {
      id: device.id,
      deviceName: device.deviceName,
      location: device.location || undefined,
      lastSeenAt: (device.lastSeenAt || device.createdAt).toISOString(),
      createdAt: device.createdAt.toISOString(),
    };
  }
}
