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
    const isExcluded =
      req.path.startsWith('/admin') || req.path.startsWith('/health');
    if (isExcluded) {
      return next();
    }

    // Redis ONLY — no DB fallback per spec
    const maintenanceMode = await this.cacheService.get<boolean>(
      'config:maintenance_mode',
    );

    if (maintenanceMode === true) {
      throw new ServiceUnavailableException({
        message: "Cheese is under maintenance. We'll be back soon.",
      });
    }

    return next();
  }
}
