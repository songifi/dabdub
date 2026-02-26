import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { SessionEntity } from '../../database/entities/session.entity';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { TwoFactorService } from './two-factor.service';
import { v4 as uuidv4 } from 'uuid';
import { LoginDto, RegisterDto, RefreshTokenDto } from '../dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessionRepository: Repository<SessionEntity>,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  async register(registerDto: RegisterDto): Promise<UserEntity> {
    const { email, password, firstName, lastName } = registerDto;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await this.passwordService.hashPassword(password);
    const userId = `user_${uuidv4()}`;

    const user = this.userRepository.create({
      id: userId,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: UserRole.USER,
      isActive: true,
    });

    return this.userRepository.save(user);
  }

  async login(
    loginDto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<any> {
    const { email, password, twoFactorCode } = loginDto;

    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.passwordService.comparePassword(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      user.lastFailedLoginAt = new Date();

      if (user.loginAttempts >= 5) {
        user.isActive = false;
      }

      await this.userRepository.save(user);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return {
          requiresTwoFactor: true,
          message: 'Two-factor authentication code required',
          userId: user.id,
        };
      }

      const isTwoFactorValid = await this.twoFactorService.verifyCode(
        user.id,
        twoFactorCode,
      );

      if (!isTwoFactorValid) {
        throw new BadRequestException('Invalid two-factor code');
      }
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user);

    // Create session
    const session = await this.sessionService.createSession(
      user.id,
      refreshToken,
      userAgent,
      ipAddress,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      expiresIn: 3600,
    };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserEntity | null> {
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
    });

    if (
      user &&
      (await this.passwordService.comparePassword(password, user.password))
    ) {
      return user;
    }

    return null;
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<any> {
    const { refreshToken } = refreshTokenDto;

    const session =
      await this.sessionService.validateRefreshToken(refreshToken);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = session.user;

    const { accessToken, refreshToken: newRefreshToken } =
      await this.generateTokens(user);

    // Update session with new refresh token
    session.refreshToken = newRefreshToken;
    session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.sessionRepository.save(session);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 3600,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionService.revokeSession(sessionId);
  }

  async generateTokens(
    user: UserEntity,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Access token: 15 minutes TTL
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    // Refresh token: 30 days TTL
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '30d',
      secret: process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
    });

    return { accessToken, refreshToken };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if user exists
      return;
    }

    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetTokenExpiry = expiresAt;

    await this.userRepository.save(user);

    // TODO: Send reset token via email
    console.log(
      `Password reset link: ${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
    );
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { passwordResetToken: resetToken },
    });

    if (!user) {
      throw new BadRequestException('Invalid reset token');
    }

    if (
      !user.passwordResetTokenExpiry ||
      user.passwordResetTokenExpiry < new Date()
    ) {
      throw new BadRequestException('Reset token has expired');
    }

    user.password = await this.passwordService.hashPassword(newPassword);
    user.passwordResetToken = null as any;
    user.passwordResetTokenExpiry = null as any;

    await this.userRepository.save(user);
  }
}
