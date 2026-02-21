import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('roles')
export class RoleEntity extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column('text', { array: true, default: '{}' })
  permissions: string[];
}
