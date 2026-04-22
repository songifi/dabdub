import { SetMetadata } from '@nestjs/common';
import type { Role } from '../rbac.types';

export const ROLES_KEY = 'rbac:roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

