import { IsEnum } from 'class-validator';
import { Permission } from '../rbac.types';

export class GrantPermissionDto {
  @IsEnum(Permission)
  permission!: Permission;
}

