import { RateLimitService } from './rate-limit.service';
import { ApiKeyRateLimitGuard } from './guards/api-key-rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { ApiKeyRateLimitGuard } from './guards/api-key-rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { ApiKeyRateLimitGuard } from './guards/api-key-rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { ApiKeyRateLimitGuard } from './guards/api-key-rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { ApiKeyRateLimitGuard } from './guards/api-key-rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { ApiKeyRateLimitGuard } from './guards/api-key-rate-limit.guard';
import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt.guard';
import { Merchant } from '../merchants/entities/merchant.entity';
import { CacheModule } from '../cache/cache.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Merchant]),
    CacheModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'fallback-secret'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [RateLimitService, ApiKeyRateLimitGuard, RateLimitService, ApiKeyRateLimitGuard, AuthService, JwtStrategy, JwtAuthGuard],
  exports: [RateLimitService, ApiKeyRateLimitGuard, RateLimitService, ApiKeyRateLimitGuard, AuthService, JwtAuthGuard],
})
export class AuthModule {}
