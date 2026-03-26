import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { jwtConfig } from '../config/jwt.config';
import { User } from '../users/entities/user.entity';
import { Role } from '../rbac/rbac.types';
import { RefreshToken } from './entities/refresh-token.entity';
import { Session } from './entities/session.entity';
import { CacheService } from '../cache/cache.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { TokenResponseDto } from './dto/token-response.dto';

export interface JwtPayload {
  sub: string;
  username: string;
  role: 'user' | 'merchant' | 'admin' | 'super_admin';
  sessionId: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(RefreshToken)
    private readonly tokenRepo: Repository<RefreshToken>,

    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,

    private readonly jwtService: JwtService,

    @Inject(jwtConfig.KEY)
    private readonly jwt: ConfigType<typeof jwtConfig>,

    private readonly cacheService: CacheService,
  ) {}

  // ── Register ────────────────────────────────────────────────────

  async register(
    dto: RegisterDto,
    ipAddress?: string,
    deviceInfo?: Record<string, unknown>,
  ): Promise<TokenResponseDto> {
    const [existingEmail, existingUsername] = await Promise.all([
      this.userRepo.findOne({ where: { email: dto.email } }),
      this.userRepo.findOne({ where: { username: dto.username } }),
    ]);

    if (existingEmail) {
      throw new ConflictException('Email already in use');
    }
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
    });
    await this.userRepo.save(user);

    const sessionId = crypto.randomUUID();
    return this.issueTokens(user, sessionId, ipAddress, deviceInfo);
  }

  // ── Login ───────────────────────────────────────────────────────

  async login(
    dto: LoginDto,
    ipAddress?: string,
    deviceInfo?: Record<string, unknown>,
  ): Promise<TokenResponseDto> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const sessionId = crypto.randomUUID();
    await this.cacheService.trackActiveUser(user.id);
    return this.issueTokens(user, sessionId, ipAddress, deviceInfo);
  }

  // ── Refresh ─────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string): Promise<TokenResponseDto> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(rawRefreshToken, {
        secret: this.jwt.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.tokenRepo.findOne({
      where: { tokenHash, sessionId: payload.sessionId },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or revoked');
    }

    // Revoke old token
    stored.revokedAt = new Date();
    await this.tokenRepo.save(stored);

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or disabled');
    }

    return this.issueTokens(user, payload.sessionId);
  }

  // ── Logout ──────────────────────────────────────────────────────

  async logout(sessionId: string): Promise<void> {
    const token = await this.tokenRepo.findOne({ where: { sessionId } });
    if (token && !token.revokedAt) {
      token.revokedAt = new Date();
      await this.tokenRepo.save(token);
    }
  }

  // ── Issue tokens ────────────────────────────────────────────────

  async issueTokens(
    user: User,
    sessionId: string,
    ipAddress?: string,
    deviceInfo?: Record<string, unknown>,
  ): Promise<TokenResponseDto> {
    const role: JwtPayload['role'] =
      user.role === Role.SuperAdmin
        ? 'super_admin'
        : user.role === Role.Admin || user.isAdmin
          ? 'admin'
          : user.role === Role.Merchant
            ? 'merchant'
            : 'user';
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role,
      sessionId,
    };

    // @nestjs/jwt v11 signs expect expiresIn as a StringValue; cast to satisfy TS.
    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwt.accessSecret,
      expiresIn: this.jwt.accessExpiry as unknown as number,
    });

    const rawRefreshToken = this.jwtService.sign(payload, {
      secret: this.jwt.refreshSecret,
      expiresIn: this.jwt.refreshExpiry as unknown as number,
    });

    const refreshExpMs = this.parseExpiry(this.jwt.refreshExpiry);
    const expiresAt = new Date(Date.now() + refreshExpMs);

    const tokenHash = this.hashToken(rawRefreshToken);
    const refreshToken = this.tokenRepo.create({
      userId: user.id,
      tokenHash,
      sessionId,
      deviceInfo: deviceInfo ?? null,
      ipAddress: ipAddress ?? null,
      expiresAt,
    });
    const savedToken = await this.tokenRepo.save(refreshToken);

    await this.sessionRepo.save(
      this.sessionRepo.create({
        userId: user.id,
        refreshTokenId: savedToken.id,
        deviceInfo: deviceInfo ?? null,
        ipAddress: ipAddress ?? null,
        lastSeenAt: new Date(),
      }),
    );

    const accessExpMs = this.parseExpiry(this.jwt.accessExpiry);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: Math.floor(accessExpMs / 1000),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Converts strings like "15m", "30d", "1h" to milliseconds. */
  private parseExpiry(expiry: string): number {
    const units: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    const match = /^(\d+)([smhd])$/.exec(expiry);
    if (!match) return 15 * 60 * 1000;
    return parseInt(match[1], 10) * (units[match[2]] ?? 1000);
  }
}
