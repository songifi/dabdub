import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(Merchant)
    private readonly merchantsRepo: Repository<Merchant>,
    private readonly cacheService: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', 'fallback-secret'),
    });
  }

  async validate(payload: any) {
    const jti: string | undefined = payload.jti ?? payload.sub;

    // Blacklist check (logout invalidation)
    if (jti) {
      const blacklisted = await this.cacheService.get<boolean>(`session:blacklist:${jti}`);
      if (blacklisted) throw new UnauthorizedException('Session revoked');
    }

    // Cache hit
    if (jti) {
      const cached = await this.cacheService.get<{ merchantId: string; email: string; role: string }>(
        `session:${jti}`,
      );
      if (cached) return cached;
    }

    // DB fallback
    const merchant = await this.merchantsRepo.findOne({ where: { id: payload.sub } });
    if (!merchant) throw new UnauthorizedException('Merchant not found');

    const result = { merchantId: merchant.id, email: merchant.email, role: merchant.role };

    // Cache with remaining token TTL
    if (jti && payload.exp) {
      const ttlSeconds = Math.max(Math.floor(payload.exp - Date.now() / 1000), 0);
      if (ttlSeconds > 0) {
        await this.cacheService.set(`session:${jti}`, result, { ttlSeconds });
      }
    }

    return result;
  }
}
