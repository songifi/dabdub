import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';
import { BlockReason } from '../enums';

@Entity('ip_blocks')
export class IpBlock extends BaseEntity {
  @Column()
  cidr: string;

  @Column({ type: 'enum', enum: BlockReason })
  reason: BlockReason;

  @Column({ type: 'text' })
  note: string;

  @Column()
  createdById: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null; // null = permanent block
}
