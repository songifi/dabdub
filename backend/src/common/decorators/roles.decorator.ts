import { SetMetadata } from '@nestjs/common';
import { Role } from '../../rbac/rbac.types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (UserRole | 'admin' | 'superadmin')[]) =>
export const Roles = (...roles: (Role | 'admin' | 'superadmin')[]) =>
  SetMetadata(ROLES_KEY, roles);
