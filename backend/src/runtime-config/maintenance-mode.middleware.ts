import { Injectable, NestMiddleware, ServiceUnavailableException, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { REDIS_CLIENT } from '../cache/redis.module';
import Redis from 'ioredis';

const MAINTENANCE_KEY = 'config:maintenance_mode';

@Injectable()
export class MaintenanceModeMiddleware implements NestMiddleware {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const path: string = req.path ?? '';

    if (path.startsWith('/admin') || path.startsWith('/health')) {
      return next();
    }

    const raw = await this.redis.get(MAINTENANCE_KEY);
    if (raw !== null) {
      try {
        if (JSON.parse(raw) === true) {
          throw new ServiceUnavailableException(
            "Cheese is under maintenance. We'll be back soon.",
          );
        }
      } catch (e) {
        if (e instanceof ServiceUnavailableException) throw e;
      }
    }

    next();
  }
}
