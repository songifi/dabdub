import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { IpBlockService } from '../../rate-limit/ip-block.service';

@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  constructor(private readonly ipBlockService: IpBlockService) {}

  async catch(
    exception: ThrottlerException,
    host: ArgumentsHost,
  ): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const ttlSeconds = 60; // sliding window TTL
    const ip = this.extractIp(request);

    // Track 429 count for this IP and potentially block it
    if (ip) {
      await this.ipBlockService.recordThrottleHit(ip);
    }

    response
      .status(HttpStatus.TOO_MANY_REQUESTS)
      .header('Retry-After', String(ttlSeconds))
      .json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests.',
        retryAfterSeconds: ttlSeconds,
      });
  }

  private extractIp(request: Request): string | null {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return String(forwarded).split(',')[0].trim();
    }
    return request.socket?.remoteAddress ?? null;
  }
}
