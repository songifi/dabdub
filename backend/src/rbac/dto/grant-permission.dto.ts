import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '../rbac.types';

export class GrantPermissionDto {
  @ApiProperty({ enum: Permission, example: Permission.KycReview })
  @IsEnum(Permission)
  permission!: Permission;
}

