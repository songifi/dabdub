import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Admin, AdminRole } from '../../admin/entities/admin.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../rbac/rbac.types';

/**
 * Allows platform staff: {@link Admin} JWT (admin/superadmin) or {@link User} with
 * {@link Role.Admin} / {@link Role.SuperAdmin}.
 */
@Injectable()
export class DisputeAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: User | Admin }>();
    const user = req.user;
    if (!user) throw new ForbiddenException();

    if ('tier' in user) {
      const r = (user as User).role;
      if (r === Role.Admin || r === Role.SuperAdmin) return true;
      throw new ForbiddenException();
    }

    const ar = (user as Admin).role;
    if (ar === AdminRole.ADMIN || ar === AdminRole.SUPERADMIN) return true;

    throw new ForbiddenException();
  }
}
