import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * Use authenticated user ID as the throttle key when available,
   * fall back to IP for unauthenticated requests.
   */
  protected async getTracker(req: Request): Promise<string> {
    const userId: string | undefined = (req as any).user?.id;
    if (userId) return userId;

    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();

    return req.socket?.remoteAddress ?? 'unknown';
  }

  protected async getThrottlerSuffix(
    context: ExecutionContext,
  ): Promise<string> {
    return '';
  }
}
