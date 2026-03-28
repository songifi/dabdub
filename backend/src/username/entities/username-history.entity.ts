import { Entity, Column, Index, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('username_histories')
export class UsernameHistory extends BaseEntity {
  @Column({ name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ name: 'old_username', length: 50 })
  oldUsername!: string;

  @Column({ name: 'new_username', length: 50 })
  newUsername!: string;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt!: Date;
}
