import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { CryptoService } from '../../common/crypto/crypto.service';
import { CacheService } from '../../cache/cache.service';
import { PasswordService } from './password.service';
import * as qrcode from 'qrcode';
import { authenticator } from 'otplib';

@Injectable()
export class AdminTwoFactorService {
  private readonly logger = new Logger(AdminTwoFactorService.name);
  private readonly setupTtl = 600; // 10 minutes
  private readonly max2FAAttempts = 5;
  private readonly lockoutDuration = 15 * 60; // 15 minutes in seconds

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly cryptoService: CryptoService,
    private readonly cacheService: CacheService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    // Configure otplib authenticator
    authenticator.options = {
      window: 1, // Allow ±30 second window (±1 step)
    };
  }

  /**
   * POST /api/v1/auth/2fa/setup
   * Initiate 2FA setup for admin user
   */
  async setup(adminId: string): Promise<{
    secret: string;
    qrCode: string;
    qrUri: string;
    expiresInSeconds: number;
  }> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    if (admin.twoFactorEnabled) {
      throw new ConflictException('2FA is already enabled for this account');
    }

    // Generate TOTP secret
    const secret = authenticator.generateSecret();

    // Encrypt and store temporarily in Redis
    const encryptedSecret = this.cryptoService.encrypt(secret);
    const redisKey = `2fa:setup:${adminId}`;
    await this.cacheService.set(redisKey, encryptedSecret, {
      ttl: this.setupTtl,
    });

    // Generate QR code URI
    const qrUri = authenticator.keyuri(
      admin.email,
      'Cheese Admin',
      secret,
    );

    // Generate QR code image as base64 PNG
    const qrCode = await qrcode.toDataURL(qrUri);

    this.logger.log(`2FA setup initiated for admin ${admin.email}`);

    return {
      secret,
      qrCode,
      qrUri,
      expiresInSeconds: this.setupTtl,
    };
  }

  /**
   * POST /api/v1/auth/2fa/verify-setup
   * Confirm and enable 2FA
   */
  async verifySetup(
    adminId: string,
    totpCode: string,
  ): Promise<{ enabled: boolean; backupCodes: string[] }> {
    // Retrieve pending secret from Redis
    const redisKey = `2fa:setup:${adminId}`;
    const encryptedSecret = await this.cacheService.get<string>(redisKey);

    if (!encryptedSecret) {
      throw new BadRequestException(
        'Setup expired or not found. Please restart 2FA setup.',
      );
    }

    // Decrypt the secret
    const secret = this.cryptoService.decrypt(encryptedSecret);

    // Validate TOTP code
    const isValid = authenticator.verify({
      token: totpCode,
      secret,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    // Get admin user
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    // Encrypt secret for storage
    const encryptedSecretForDb = this.cryptoService.encrypt(secret);

    // Generate backup codes
    const backupCodes = this.cryptoService.generateBackupCodes(10);
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => this.cryptoService.hashBackupCode(code)),
    );

    // Persist to database
    admin.twoFactorSecret = encryptedSecretForDb;
    admin.twoFactorEnabled = true;
    admin.backupCodeHashes = hashedBackupCodes;
    await this.userRepository.save(admin);

    // Delete Redis setup key
    await this.cacheService.del(redisKey);

    // Invalidate all other sessions (security measure)
    await this.invalidateAllSessions(adminId);

    this.logger.log(`ADMIN_2FA_ENABLED for ${admin.email}`);

    return {
      enabled: true,
      backupCodes,
    };
  }

  /**
   * POST /api/v1/auth/2fa/disable
   * Disable 2FA (not allowed for SUPER_ADMIN and FINANCE_ADMIN)
   */
  async disable(
    adminId: string,
    totpCode: string,
    password: string,
  ): Promise<void> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    // Check if 2FA is mandatory for this role
    if (
      admin.role === UserRole.SUPER_ADMIN ||
      admin.role === UserRole.FINANCE_ADMIN
    ) {
      throw new ForbiddenException(
        '2FA is mandatory for SUPER_ADMIN and FINANCE_ADMIN roles',
      );
    }

    // Validate password
    const isPasswordValid = await this.passwordService.comparePassword(
      password,
      admin.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Validate TOTP code
    if (!admin.twoFactorSecret) {
      throw new BadRequestException('2FA is not enabled');
    }

    const secret = this.cryptoService.decrypt(admin.twoFactorSecret);
    const isValid = authenticator.verify({
      token: totpCode,
      secret,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    // Clear 2FA settings
    admin.twoFactorSecret = null as any;
    admin.twoFactorEnabled = false;
    admin.backupCodeHashes = null as any;
    await this.userRepository.save(admin);

    // Invalidate all sessions
    await this.invalidateAllSessions(adminId);

    this.logger.log(`ADMIN_2FA_DISABLED for ${admin.email}`);
  }

  /**
   * POST /api/v1/auth/2fa/validate
   * Validate TOTP during login (step 2)
   */
  async validate(
    twoFactorToken: string,
    totpCode?: string,
    backupCode?: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    admin: { id: string; email: string; role: string };
  }> {
    // Verify twoFactorToken
    let payload: any;
    try {
      payload = this.jwtService.verify(twoFactorToken);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired 2FA token');
    }

    if (payload.type !== '2fa_pending') {
      throw new UnauthorizedException('Invalid token type');
    }

    const adminId = payload.sub;

    // Check 2FA attempt lockout
    const lockoutKey = `2fa:lockout:${adminId}`;
    const isLockedOut = await this.cacheService.get(lockoutKey);
    if (isLockedOut) {
      throw new ForbiddenException(
        '2FA validation locked due to too many failed attempts. Try again in 15 minutes.',
      );
    }

    // Retrieve admin
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
    });

    if (!admin || !admin.twoFactorEnabled || !admin.twoFactorSecret) {
      throw new UnauthorizedException('2FA not properly configured');
    }

    // Decrypt secret
    const secret = this.cryptoService.decrypt(admin.twoFactorSecret);

    let isValid = false;
    let usedBackupCode: string | null = null;

    // Validate TOTP code or backup code
    if (totpCode) {
      isValid = authenticator.verify({
        token: totpCode,
        secret,
      });
    } else if (backupCode) {
      // Check backup codes
      if (admin.backupCodeHashes && admin.backupCodeHashes.length > 0) {
        for (const hash of admin.backupCodeHashes) {
          const matches = await this.cryptoService.verifyBackupCode(
            backupCode,
            hash,
          );
          if (matches) {
            isValid = true;
            usedBackupCode = hash;
            break;
          }
        }
      }
    } else {
      throw new BadRequestException(
        'Either totpCode or backupCode must be provided',
      );
    }

    if (!isValid) {
      // Increment attempt counter
      await this.increment2FAAttempts(adminId);
      this.logger.warn(`ADMIN_2FA_FAILED for ${admin.email}`);
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Remove used backup code
    if (usedBackupCode && admin.backupCodeHashes) {
      admin.backupCodeHashes = admin.backupCodeHashes.filter(
        (hash) => hash !== usedBackupCode,
      );
      await this.userRepository.save(admin);
    }

    // Clear attempt counter
    await this.cacheService.del(`2fa:attempts:${adminId}`);

    this.logger.log(`ADMIN_2FA_VALIDATED for ${admin.email}`);

    // Issue full access token + refresh token
    return this.issueTokens(admin, payload.sessionId, payload.userAgent, payload.ipAddress);
  }

  /**
   * POST /api/v1/auth/2fa/regenerate-backup-codes
   * Regenerate backup codes
   */
  async regenerateBackupCodes(
    adminId: string,
    totpCode: string,
  ): Promise<{ backupCodes: string[] }> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
    });

    if (!admin || !admin.twoFactorEnabled || !admin.twoFactorSecret) {
      throw new BadRequestException('2FA is not enabled');
    }

    // Validate TOTP code
    const secret = this.cryptoService.decrypt(admin.twoFactorSecret);
    const isValid = authenticator.verify({
      token: totpCode,
      secret,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    // Generate new backup codes
    const backupCodes = this.cryptoService.generateBackupCodes(10);
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => this.cryptoService.hashBackupCode(code)),
    );

    // Update database
    admin.backupCodeHashes = hashedBackupCodes;
    await this.userRepository.save(admin);

    this.logger.log(`ADMIN_BACKUP_CODES_REGENERATED for ${admin.email}`);

    return { backupCodes };
  }

  /**
   * Verify a TOTP code for a specific admin (used for sensitive actions)
   */
  async verify2FACode(adminId: string, totpCode: string): Promise<boolean> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
    });

    if (!admin || !admin.twoFactorEnabled || !admin.twoFactorSecret) {
      return false;
    }

    const secret = this.cryptoService.decrypt(admin.twoFactorSecret);
    return authenticator.verify({
      token: totpCode,
      secret,
    });
  }

  /**
   * Helper: Invalidate all sessions for an admin
   */
  private async invalidateAllSessions(adminId: string): Promise<void> {
    const pattern = `auth:refresh:${adminId}:*`;
    await this.cacheService.delPattern(pattern);

    const sessions = await this.cacheService.hgetall(`auth:sessions:${adminId}`);
    if (sessions) {
      for (const sessionId of Object.keys(sessions)) {
        await this.cacheService.hdel(`auth:sessions:${adminId}`, sessionId);
      }
    }
  }

  /**
   * Helper: Increment 2FA attempt counter and lock if needed
   */
  private async increment2FAAttempts(adminId: string): Promise<void> {
    const attemptsKey = `2fa:attempts:${adminId}`;
    const attempts = await this.cacheService.get<number>(attemptsKey);
    const newAttempts = (attempts || 0) + 1;

    await this.cacheService.set(attemptsKey, newAttempts, {
      ttl: this.lockoutDuration,
    });

    if (newAttempts >= this.max2FAAttempts) {
      const lockoutKey = `2fa:lockout:${adminId}`;
      await this.cacheService.set(lockoutKey, true, {
        ttl: this.lockoutDuration,
      });
      this.logger.warn(`2FA lockout triggered for admin ${adminId}`);
    }
  }

  /**
   * Helper: Issue full access and refresh tokens
   */
  private async issueTokens(
    admin: UserEntity,
    sessionId: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    admin: { id: string; email: string; role: string };
  }> {
    const adminJwtExpiresIn =
      this.configService.get<string>('ADMIN_JWT_EXPIRES_IN') || '2h';
    const refreshTokenExpiresIn = '7d';

    const accessTokenPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'admin',
      sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp:
        Math.floor(Date.now() / 1000) +
        this.parseExpirationTime(adminJwtExpiresIn),
    };

    const refreshTokenPayload = {
      sub: admin.id,
      sessionId,
      type: 'admin_refresh',
      iat: Math.floor(Date.now() / 1000),
      exp:
        Math.floor(Date.now() / 1000) +
        this.parseExpirationTime(refreshTokenExpiresIn),
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      expiresIn: this.parseExpirationTime(adminJwtExpiresIn),
    });

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      expiresIn: this.parseExpirationTime(refreshTokenExpiresIn),
    });

    // Create admin session in Redis
    await this.createAdminSessionRedis(
      admin.id,
      sessionId,
      refreshToken,
      userAgent,
      ipAddress,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.parseExpirationTime(adminJwtExpiresIn),
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  private async createAdminSessionRedis(
    adminId: string,
    sessionId: string,
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<void> {
    const sessionData = {
      sessionId,
      ip: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      isCurrent: true,
    };

    await this.cacheService.hset(
      `auth:sessions:${adminId}`,
      sessionId,
      JSON.stringify(sessionData),
    );

    const crypto = require('crypto');
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    await this.cacheService.set(
      `auth:refresh:${adminId}:${sessionId}`,
      tokenHash,
      { ttl: 7 * 24 * 60 * 60 },
    );
  }

  private parseExpirationTime(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 3600;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 3600;
    }
  }
}
