import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth.service';
import { RateLimitService } from '../rate-limit.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimitService: RateLimitService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const rawKey = req.headers['x-api-key'];

    if (typeof rawKey === 'string' && rawKey.trim().length > 0) {
      const merchant = await this.authService.findMerchantByApiKey(rawKey.trim());
      if (!merchant) {
        throw new UnauthorizedException('Invalid API key');
      }

      req.user = {
        merchantId: merchant.id,
        email: merchant.email,
        role: merchant.role,
      };

      // Apply per-merchant sliding window rate limit
      const result = await this.rateLimitService.checkApiKeyRateLimit(
        merchant.id,
        merchant.role,
      );

      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt);

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter ?? 3600);
        res.status(429).json({
          statusCode: 429,
          error: 'Too Many Requests',
          message: `API key rate limit exceeded. Limit: ${result.limit} requests/hour.`,
          retryAfter: result.retryAfter,
        });
        return false;
      }

      return true;
    }

    return (await super.canActivate(context)) as boolean;
  }
}
