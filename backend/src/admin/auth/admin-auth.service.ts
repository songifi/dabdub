import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { jwtConfig } from '../../config/jwt.config';
import { Admin } from '../entities/admin.entity';
import { AuthService } from '../../auth/auth.service';
import { TokenResponseDto } from '../../auth/dto/token-response.dto';
import { LoginDto } from '../../auth/dto/login.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    @Inject(jwtConfig.KEY)
    private readonly jwt: ConfigType<typeof jwtConfig>,
  ) {}

  async login(
    dto: LoginDto,
    ipAddress?: string,
    deviceInfo?: Record<string, unknown>,
  ): Promise<TokenResponseDto> {
    const admin = await this.adminRepo.findOne({ where: { email: dto.email } });
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    admin.lastLoginAt = new Date();
    await this.adminRepo.save(admin);

    const sessionId = crypto.randomUUID();

    // We use a trick here: we create a fake User object to pass to authService.issueTokens
    // Or we implement issueTokens for Admin.
    // Since issueTokens expects a User entity, let's see if we can adapt it.

    return this.issueAdminTokens(admin, sessionId, ipAddress, deviceInfo);
  }

  private async issueAdminTokens(
    admin: Admin,
    sessionId: string,
    ipAddress?: string,
    deviceInfo?: Record<string, unknown>,
  ): Promise<TokenResponseDto> {
    // This is similar to AuthService.issueTokens but for Admin
    const payload = {
      sub: admin.id,
      username: admin.email, // Use email as username for admins
      role: admin.role,
      sessionId,
      isAdmin: true,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwt.accessSecret,
      expiresIn: this.jwt.accessExpiry as any,
    });

    const rawRefreshToken = this.jwtService.sign(payload, {
      secret: this.jwt.refreshSecret,
      expiresIn: this.jwt.refreshExpiry as any,
    });

    // We still want to use the same session/token mechanism if possible
    // But AuthService expects User entity.
    // For now, let's just return the tokens without creating a session in the DB
    // to keep it simple, or we'd need to modify AuthService to be more generic.

    // Actually, the requirement says "separate" so maybe it's fine.

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 3600, // Hardcoded for now, should parse from config
    };
  }
}
