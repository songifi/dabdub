import {
  Injectable,
  NestMiddleware,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AdminRole } from '../../admin/entities/admin.entity';
import { Role } from '../../rbac/rbac.types';
import { MaintenanceService } from '../maintenance.service';

interface RequestWithUser extends Request {
  user?: { id?: string; role?: string };
}

function bypassesMaintenanceForRole(role: string | undefined): boolean {
  if (!role) return false;
  return (
    role === Role.Admin ||
    role === Role.SuperAdmin ||
    role === AdminRole.ADMIN ||
    role === AdminRole.SUPERADMIN
  );
}

@Injectable()
export class MaintenanceWindowMiddleware implements NestMiddleware {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  async use(req: RequestWithUser, res: Response, next: NextFunction) {
    if (bypassesMaintenanceForRole(req.user?.role)) {
      return next();
    }

    const path = req.path;
    if (
      path.includes('/health') ||
      path.includes('/admin/') ||
      path.includes('/system/maintenance')
    ) {
      return next();
    }

    // Get active maintenance windows from cache
    const activeWindows = await this.maintenanceService.getActive();
    
    if (activeWindows.length === 0) {
      return next();
    }

    // Check if current route is affected by any active maintenance window
    const affectedWindow = activeWindows.find(window => 
      this.isServiceAffected(req.path, window.affectedServices)
    );

    if (affectedWindow) {
      throw new ServiceUnavailableException({
        code: 'MAINTENANCE',
        message: affectedWindow.title,
        description: affectedWindow.description,
        estimatedRestoration: affectedWindow.endAt,
        affectedServices: affectedWindow.affectedServices,
      });
    }

    next();
  }

  private isServiceAffected(path: string, affectedServices: string[]): boolean {
    // If 'all' is in affected services, everything is affected
    if (affectedServices.includes('all')) {
      return true;
    }

    // Map route prefixes to service names
    const serviceMap: Record<string, string> = {
      '/api/v1/transfers': 'transfers',
      '/api/v1/withdrawals': 'withdrawals',
      '/api/v1/bank-accounts': 'banking',
      '/api/v1/virtual-cards': 'cards',
      '/api/v1/paylink': 'paylinks',
      '/api/v1/merchants': 'merchants',
      '/api/v1/wallets': 'wallets',
      '/api/v1/auth': 'auth',
    };

    // Check if the request path matches any affected service
    for (const [routePrefix, serviceName] of Object.entries(serviceMap)) {
      if (path.startsWith(routePrefix) && affectedServices.includes(serviceName)) {
        return true;
      }
    }

    return false;
  }
}