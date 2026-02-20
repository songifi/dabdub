import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { ApiKeyStrategy } from './strategies/api-key.strategy';
import { UserEntity } from '../database/entities/user.entity';
import { ApiKeyEntity } from '../database/entities/api-key.entity';
import { SessionEntity } from '../database/entities/session.entity';
import { AdminSessionEntity } from './entities/admin-session.entity';
import { AdminLoginAttemptEntity } from './entities/admin-login-attempt.entity';
import { TwoFactorService } from './services/two-factor.service';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { AdminAuthService } from './services/admin-auth.service';
import { ApiKeyService } from './services/api-key.service';
import { JwtGuard } from './guards/jwt.guard';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { RequirePermissionGuard } from './guards/require-permission.guard';
import { AdminThrottlerGuard } from '../common/guards/admin-throttler.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity, 
      ApiKeyEntity, 
      SessionEntity,
      AdminSessionEntity,
      AdminLoginAttemptEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn:
            configService.get<string>('JWT_EXPIRATION') || ('1h' as any),
          algorithm: 'HS256',
        },
      }),
    }),
  ],
  controllers: [AuthController, AdminAuthController],
  providers: [
    AuthService,
    AdminAuthService,
    JwtStrategy,
    AdminJwtStrategy,
    LocalStrategy,
    ApiKeyStrategy,
    TwoFactorService,
    PasswordService,
    SessionService,
    ApiKeyService,
    JwtGuard,
    AdminJwtGuard,
    RequirePermissionGuard,
    AdminThrottlerGuard,
  ],
  exports: [
    AuthService,
    AdminAuthService,
    JwtGuard,
    AdminJwtGuard,
    RequirePermissionGuard,
    PasswordService,
    SessionService,
    ApiKeyService,
  ],
})
export class AuthModule {}
