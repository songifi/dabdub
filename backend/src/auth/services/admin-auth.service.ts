import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AdminSessionEntity } from '../entities/admin-session.entity';
import { AdminLoginAttemptEntity } from '../entities/admin-login-attempt.entity';
import { PasswordService } from './password.service';
import { AdminLoginDto, AdminRefreshTokenDto, AdminSessionDto } from '../dto/admin-auth.dto';
import { AdminJwtPayload } from '../strategies/admin-jwt.strategy';
import { v4 as uuidv4 } from 'uuid';
import { CacheService } from '../../cache/cache.service';
import * as crypto from 'crypto';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly maxFailedAttempts = 5;
  private readonly lockoutDurationMs = 30 * 60 * 1000; // 30 minutes
  private readonly attemptWindowMs = 10 * 60 * 1000; // 10 minutes

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(AdminSessionEntity)
    private readonly adminSessionRepository: Repository<AdminSessionEntity>,
    @InjectRepository(AdminLoginAttemptEntity)
    private readonly adminLoginAttemptRepository: Repository<AdminLoginAttemptEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly cacheService: CacheService,
  ) { }

  async login(
    loginDto: AdminLoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<any> {
    const { email, password } = loginDto;

    // Check for account lockout
    await this.checkAccountLockout(email, ipAddress);

    // Find admin user
    const user = await this.userRepository.findOne({
      where: {
        email,
        isActive: true,
      },
    });

    let loginAttempt: AdminLoginAttemptEntity;

    try {
      if (!user || ![UserRole.ADMIN, UserRole.SUPPORT_ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) {
        await this.recordFailedAttempt(email, ipAddress, userAgent, 'Invalid credentials');
        throw new UnauthorizedException('Invalid email or password');
      }

      const isPasswordValid = await this.passwordService.comparePassword(
        password,
        user.password,
      );

      if (!isPasswordValid) {
        await this.recordFailedAttempt(email, ipAddress, userAgent, 'Invalid password');
        throw new UnauthorizedException('Invalid email or password');
      }

      // Record successful attempt
      loginAttempt = this.adminLoginAttemptRepository.create({
        email,
        ipAddress: ipAddress || 'unknown',
        userAgent,
        successful: true,
      });
      await this.adminLoginAttemptRepository.save(loginAttempt);

      // Check if 2FA is enabled
      if (user.twoFactorEnabled) {
        // Issue a short-lived 2FA token instead of full access
        const sessionId = uuidv4();
        const twoFactorTokenPayload = {
          sub: user.id,
          type: '2fa_pending',
          sessionId,
          userAgent,
          ipAddress,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
        };

        const twoFactorToken = this.jwtService.sign(twoFactorTokenPayload, {
          expiresIn: 300,
        });

        this.logger.log(`2FA required for admin ${email}`);

        return {
          requires2FA: true,
          twoFactorToken,
          message: 'Please provide your 2FA code to complete login',
        };
      }

      // Generate tokens
      const adminJwtExpiresIn = this.configService.get<string>('ADMIN_JWT_EXPIRES_IN') || '2h';
      const refreshTokenExpiresIn = '7d';
      const sessionId = uuidv4();

      const accessTokenPayload: AdminJwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: 'admin',
        sessionId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.parseExpirationTime(adminJwtExpiresIn),
      };

      const refreshTokenPayload = {
        sub: user.id,
        sessionId,
        type: 'admin_refresh',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.parseExpirationTime(refreshTokenExpiresIn),
      };

      const accessToken = this.jwtService.sign(accessTokenPayload, {
        expiresIn: adminJwtExpiresIn as any,
      });

      const refreshToken = this.jwtService.sign(refreshTokenPayload, {
        expiresIn: refreshTokenExpiresIn as any,
      });

      // Create admin session
      await this.createAdminSessionRedis(user.id, sessionId, refreshToken, userAgent, ipAddress);

      this.logger.log(`Admin login successful for ${email} from ${ipAddress}`);

      return {
        access_token: accessToken,
        expires_in: this.parseExpirationTime(adminJwtExpiresIn),
        admin: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        refresh_token: refreshToken,
        refreshToken: refreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Admin login error for ${email}: ${error.message}`);
      throw new BadRequestException('Login failed');
    }
  }

  async refresh(
    refreshDto: AdminRefreshTokenDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<any> {
    const { refreshToken } = refreshDto;
    const token = refreshToken || (refreshDto as any).refresh_token;

    try {
      const payload = this.jwtService.verify(token);

      if (payload.type !== 'admin_refresh' || !payload.sessionId) {
        throw new UnauthorizedException('Invalid refresh token type or missing session');
      }

      const adminId = payload.sub;
      const sessionId = payload.sessionId;

      const storedHash = await this.cacheService.get<string>(`auth:refresh:${adminId}:${sessionId}`);
      if (!storedHash) {
        // Token was already used or revoked -> 401
        throw new UnauthorizedException('Session expired or token revoked');
      }

      const incomingHash = crypto.createHash('sha256').update(token).digest('hex');
      if (storedHash !== incomingHash) {
        throw new UnauthorizedException('Invalid token');
      }

      const user = await this.userRepository.findOne({
        where: { id: adminId, isActive: true },
      });

      if (!user || ![UserRole.ADMIN, UserRole.SUPPORT_ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) {
        throw new UnauthorizedException('User not authorized');
      }

      // Delete old token (Rotation)
      await this.cacheService.del(`auth:refresh:${adminId}:${sessionId}`);

      // Generate new access token
      const adminJwtExpiresIn = this.configService.get<string>('ADMIN_JWT_EXPIRES_IN') || '2h';
      const refreshTokenExpiresIn = '7d';

      const accessTokenPayload: AdminJwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: 'admin',
        sessionId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.parseExpirationTime(adminJwtExpiresIn),
      };

      const refreshTokenPayload = {
        sub: user.id,
        sessionId,
        type: 'admin_refresh',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.parseExpirationTime(refreshTokenExpiresIn),
      };

      const newAccessToken = this.jwtService.sign(accessTokenPayload, {
        expiresIn: this.parseExpirationTime(adminJwtExpiresIn),
      });

      const newRefreshToken = this.jwtService.sign(refreshTokenPayload, {
        expiresIn: this.parseExpirationTime(refreshTokenExpiresIn),
      });

      // Store new refresh token hash
      const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
      await this.cacheService.set(
        `auth:refresh:${adminId}:${sessionId}`,
        newTokenHash,
        { ttl: this.parseExpirationTime(refreshTokenExpiresIn) }
      );

      // Update session lastUsedAt
      const sessionJson = await this.cacheService.hget(`auth:sessions:${adminId}`, sessionId);
      if (sessionJson) {
        const sessionData = JSON.parse(sessionJson);
        sessionData.lastUsedAt = new Date().toISOString();
        if (ipAddress) sessionData.ip = ipAddress;
        if (userAgent) sessionData.userAgent = userAgent;
        await this.cacheService.hset(`auth:sessions:${adminId}`, sessionId, JSON.stringify(sessionData));
      }

      this.logger.log(`Admin token refreshed for ${user.email} from ${ipAddress}`);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.parseExpirationTime(adminJwtExpiresIn),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn(`Admin token refresh failed: ${error.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(adminId: string, sessionId: string, refreshToken?: string): Promise<void> {
    await this.cacheService.del(`auth:refresh:${adminId}:${sessionId}`);
    await this.cacheService.hdel(`auth:sessions:${adminId}`, sessionId);
    this.logger.log(`audit event ADMIN_LOGOUT: session ${sessionId}`);
  }

  async logoutAll(adminId: string): Promise<void> {
    const pattern = `auth:refresh:${adminId}:*`;
    await this.cacheService.delPattern(pattern);

    // Deleting all sessions from Hash map
    const sessions = await this.cacheService.hgetall(`auth:sessions:${adminId}`);
    if (sessions) {
      for (const sessionId of Object.keys(sessions)) {
        await this.cacheService.hdel(`auth:sessions:${adminId}`, sessionId);
      }
    }
    this.logger.log(`audit event ADMIN_LOGOUT_ALL: for admin ${adminId}`);
  }

  async getSessions(adminId: string, currentSessionId?: string): Promise<AdminSessionDto[]> {
    const sessionsRaw = await this.cacheService.hgetall(`auth:sessions:${adminId}`);
    if (!sessionsRaw) return [];

    const sessions: AdminSessionDto[] = [];
    for (const [sessionId, sessionJson] of Object.entries(sessionsRaw)) {
      try {
        const parsed = JSON.parse(sessionJson);
        parsed.isCurrent = sessionId === currentSessionId;
        sessions.push(parsed);
      } catch (e) {
        // ignore parse error
      }
    }
    return sessions;
  }

  async revokeSession(currentAdminId: string, currentRole: UserRole, sessionIdToRevoke: string): Promise<void> {
    // Determine the target adminId
    let targetAdminId = currentAdminId;

    if (currentRole === UserRole.SUPER_ADMIN) {
      const sessionRaw = await this.cacheService.hget(`auth:sessions:${currentAdminId}`, sessionIdToRevoke);
      if (!sessionRaw) {
        await this.cacheService.delPattern(`auth:refresh:*:${sessionIdToRevoke}`);
      }
    }

    const sessionRaw = await this.cacheService.hget(`auth:sessions:${targetAdminId}`, sessionIdToRevoke);
    if (sessionRaw || currentRole !== UserRole.SUPER_ADMIN) {
      await this.cacheService.del(`auth:refresh:${targetAdminId}:${sessionIdToRevoke}`);
      await this.cacheService.hdel(`auth:sessions:${targetAdminId}`, sessionIdToRevoke);
    }
    this.logger.log(`audit event REVOKE_SESSION: ${sessionIdToRevoke} by admin ${currentAdminId}`);
  }

  private async checkAccountLockout(email: string, ipAddress?: string): Promise<void> {
    const tenMinutesAgo = new Date(Date.now() - this.attemptWindowMs);

    const recentFailedAttempts = await this.adminLoginAttemptRepository.count({
      where: {
        email,
        successful: false,
        createdAt: MoreThan(tenMinutesAgo),
      },
    });

    if (recentFailedAttempts >= this.maxFailedAttempts) {
      const lastFailedAttempt = await this.adminLoginAttemptRepository.findOne({
        where: { email, successful: false },
        order: { createdAt: 'DESC' },
      });

      if (lastFailedAttempt) {
        const lockoutEndTime = new Date(lastFailedAttempt.createdAt.getTime() + this.lockoutDurationMs);
        if (new Date() < lockoutEndTime) {
          const remainingMinutes = Math.ceil((lockoutEndTime.getTime() - Date.now()) / 60000);

          this.logger.warn(
            `Admin account lockout triggered for ${email} from ${ipAddress}. ` +
            `${recentFailedAttempts} failed attempts in last 10 minutes.`
          );

          throw new ForbiddenException(
            `Account locked due to too many failed login attempts. Try again in ${remainingMinutes} minutes.`
          );
        }
      }
    }
  }

  private async recordFailedAttempt(
    email: string,
    ipAddress?: string,
    userAgent?: string,
    reason?: string,
  ): Promise<void> {
    const attempt = this.adminLoginAttemptRepository.create({
      email,
      ipAddress: ipAddress || 'unknown',
      userAgent,
      successful: false,
      failureReason: reason,
    });

    await this.adminLoginAttemptRepository.save(attempt);

    this.logger.warn(`Failed admin login attempt for ${email} from ${ipAddress}: ${reason}`);
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

    // Store session metadata
    await this.cacheService.hset(
      `auth:sessions:${adminId}`,
      sessionId,
      JSON.stringify(sessionData)
    );

    // Store refresh token hash
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.cacheService.set(
      `auth:refresh:${adminId}:${sessionId}`,
      tokenHash,
      { ttl: 7 * 24 * 60 * 60 } // 7 days in seconds
    );
  }

  private parseExpirationTime(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 3600;
    }
  }
}
