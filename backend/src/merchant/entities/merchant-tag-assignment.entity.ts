import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MerchantTag } from './merchant-tag.entity';
import { UserEntity } from '../../database/entities/user.entity';

@Entity('merchant_tag_assignments')
@Index(['merchantId', 'tagId'], { unique: true })
@Index(['merchantId'])
@Index(['tagId'])
export class MerchantTagAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @Column({ name: 'tag_id' })
  tagId: string;

  @ManyToOne(() => MerchantTag, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag: MerchantTag;

  @Column({ name: 'assigned_by_id' })
  assignedById: string;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_by_id' })
  assignedBy: UserEntity;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
