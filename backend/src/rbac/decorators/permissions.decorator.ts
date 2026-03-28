import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../rbac.types';

export const PERMISSIONS_KEY = 'rbac:permissions';
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
