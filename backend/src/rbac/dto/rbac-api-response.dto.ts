import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '../rbac.types';

export class OkResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;
}

export class AdminPermissionsListResponseDto {
  @ApiProperty({ enum: Permission, isArray: true })
  permissions!: Permission[];
}

export class KycApproveResponseDto {
  @ApiProperty({ example: true })
  ok!: true;

  @ApiProperty({ format: 'uuid' })
  id!: string;
}
