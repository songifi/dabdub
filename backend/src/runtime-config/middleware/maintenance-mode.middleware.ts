import {
  Injectable,
  NestMiddleware,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class MaintenanceModeMiddleware implements NestMiddleware {
  constructor(private readonly cacheService: CacheService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // 1. Check if it's an admin or health route
    const isExcluded = req.path.startsWith('/admin') || req.path.startsWith('/health');
    if (isExcluded) {
      return next();
    }

    // 2. Read from Redis ONLY (no DB call)
    const maintenanceMode = await this.cacheService.get<boolean>('config:maintenance_mode');

    if (maintenanceMode === true) {
      throw new ServiceUnavailableException({
        message: "Cheese is under maintenance. We'll be back soon.",
      });
    }

    next();
  }
}
