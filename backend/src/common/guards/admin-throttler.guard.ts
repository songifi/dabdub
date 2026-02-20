import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { ThrottlerStorage } from '@nestjs/throttler';
import { THROTTLE_BY_API_KEY } from '../decorators/throttle-by-api-key.decorator';

@Injectable()
export class AdminThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    req._throttleByApiKey = this.reflector.getAllAndOverride<boolean>(
      THROTTLE_BY_API_KEY,
      [context.getHandler(), context.getClass()],
    );

    return super.canActivate(context);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const parentSkip = await super.shouldSkip(context);
    if (parentSkip) return true;

    const req = context.switchToHttp().getRequest();
    return this.getWhitelistedIps().includes(this.getClientIp(req));
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req._throttleByApiKey) {
      const apiKey = req.headers['x-api-key'];
      if (apiKey) return `api-key:${apiKey}`;
    }

    return this.getClientIp(req);
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { timeToExpire, timeToBlockExpire, isBlocked } = throttlerLimitDetail;
    const retryAfter = isBlocked ? timeToBlockExpire : timeToExpire;

    const res = context.switchToHttp().getResponse();
    res.header('Retry-After', retryAfter);

    const req = context.switchToHttp().getRequest();

    throw new HttpException(
      {
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private getClientIp(req: Record<string, any>): string {
    const forwardedFor = req.headers?.['x-forwarded-for'] as string | undefined;
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }
    return (Array.isArray(req.ips) && req.ips.length ? req.ips[0] : req.ip) ?? '127.0.0.1';
  }

  private getWhitelistedIps(): string[] {
    return (process.env.THROTTLE_WHITELIST_IPS ?? '127.0.0.1,::1')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);
  }
}
