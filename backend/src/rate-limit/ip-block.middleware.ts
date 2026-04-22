import { Injectable, NestMiddleware, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IpBlockService } from './ip-block.service';

@Injectable()
export class IpBlockMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpBlockMiddleware.name);

  constructor(private readonly ipBlockService: IpBlockService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const ip = this.extractIp(req);

    if (ip && (await this.ipBlockService.isBlocked(ip))) {
      this.logger.warn(`Blocked IP attempted request: ${ip}`);
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests.',
        retryAfterSeconds: 3600,
      });
      return;
    }

    next();
  }

  private extractIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return String(forwarded).split(',')[0].trim();
    }
    return req.socket?.remoteAddress ?? null;
  }
}
