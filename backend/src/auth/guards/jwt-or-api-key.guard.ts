import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ExtractJwt } from 'passport-jwt';
import type { Request } from 'express';
import { Merchant } from '../../merchants/entities/merchant.entity';

type AuthedRequest = Request & { user?: { merchantId: string; email: string } };

@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Merchant)
    private readonly merchantsRepo: Repository<Merchant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const rawHeader = req.headers['x-api-key'];
    const apiKey = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (apiKey) {
      const merchants = await this.merchantsRepo.find({
        where: { apiKeyHash: Not(IsNull()) },
      });
      for (const m of merchants) {
        if (m.apiKeyHash && (await bcrypt.compare(apiKey, m.apiKeyHash))) {
          req.user = { merchantId: m.id, email: m.email };
          return true;
        }
      }
      throw new UnauthorizedException('Invalid API key');
    }

    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (!token) {
      throw new UnauthorizedException('Missing authentication');
    }
    try {
      const payload = this.jwtService.verify<{ sub: string; email: string }>(token);
      req.user = { merchantId: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
