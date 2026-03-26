import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Permission } from '../rbac.types';

@Entity('admin_permissions')
@Index(['adminId'])
@Index(['adminId', 'permission'], { unique: true })
export class AdminPermission extends BaseEntity {
  @Column({ name: 'admin_id', type: 'uuid' })
  adminId!: string;

  @Column({ type: 'enum', enum: Permission })
  permission!: Permission;

  @Column({ name: 'granted_by', type: 'uuid' })
  grantedBy!: string;

  @Column({ name: 'granted_at', type: 'timestamptz', default: () => 'NOW()' })
  grantedAt!: Date;
}
