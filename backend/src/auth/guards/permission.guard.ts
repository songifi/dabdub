import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  UserRole,
  ROLE_PERMISSIONS,
  RESTRICTED_FOR_SUPPORT_ADMIN,
} from '../../database/entities/user.entity';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>(
      PERMISSIONS_KEY,
      context.getHandler(),
    );
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const userRole = user.role as UserRole;
    const permissions = ROLE_PERMISSIONS[userRole] || [];

    // Check if user has at least one of the required permissions
    const hasPermission = requiredPermissions.some((permission) =>
      permissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Check if SUPPORT_ADMIN is trying to access restricted permissions
    if (
      userRole === UserRole.SUPPORT_ADMIN &&
      requiredPermissions.some((p) => RESTRICTED_FOR_SUPPORT_ADMIN.has(p))
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
