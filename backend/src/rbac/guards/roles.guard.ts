import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_HIERARCHY, Role } from '../rbac.types';
import { ROLES_KEY } from '../decorators/roles.decorator';

type RequestWithUser = { user?: { role?: Role } };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const role = req.user?.role ?? Role.User;

    const rank = ROLE_HIERARCHY[role] ?? 0;
    const allowed = required.some((r) => rank >= (ROLE_HIERARCHY[r] ?? 0));
    if (!allowed) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
