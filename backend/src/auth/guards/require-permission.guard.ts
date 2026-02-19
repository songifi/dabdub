import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, ROLE_PERMISSIONS, RESTRICTED_FOR_SUPPORT_ADMIN } from '../../database/entities/user.entity';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

/**
 * Guard that requires the request user to have a specific permission.
 * SUPPORT_ADMIN receives 403 for permissions in RESTRICTED_FOR_SUPPORT_ADMIN (e.g. analytics:revenue).
 */
@Injectable()
export class RequirePermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.get<string>(
      REQUIRE_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!permission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const role = user.role as UserRole;
    const permissions = ROLE_PERMISSIONS[role];
    if (!permissions?.includes(permission)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (role === UserRole.SUPPORT_ADMIN && RESTRICTED_FOR_SUPPORT_ADMIN.has(permission)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
