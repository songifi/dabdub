import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Admin, AdminRole } from '../../admin/entities/admin.entity';

/**
 * Requires an authenticated Admin JWT with {@link AdminRole.SUPERADMIN}.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: Admin }>();
    const user = req.user;
    if (!user || typeof user !== 'object' || !('role' in user)) {
      throw new ForbiddenException();
    }
    if ((user as Admin).role !== AdminRole.SUPERADMIN) {
      throw new ForbiddenException();
    }
    return true;
  }
}
