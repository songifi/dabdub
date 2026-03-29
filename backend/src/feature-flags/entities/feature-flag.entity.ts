feature/implement-4-issues
import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
main

export enum FeatureFlagStatus {
  DISABLED = 'disabled',
  ENABLED = 'enabled',
  PERCENTAGE = 'percentage',
  TIER = 'tier',
  USERS = 'users',
}

@Entity('feature_flags')
 feature/implement-4-issues
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 100 })
  key!: string;

  @Column({ length: 500 })
  description!: string;

  @Column({ type: 'enum', enum: FeatureFlagStatus })
  status!: FeatureFlagStatus;

  @Column({ type: 'int', nullable: true })

export class FeatureFlag extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  key!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    type: 'enum',
    enum: FeatureFlagStatus,
  })
  status!: FeatureFlagStatus;

  @Column({ type: 'int', nullable: true, default: null })
main
  percentage!: number | null;

  @Column({ name: 'enabled_tiers', type: 'text', array: true, nullable: true })
  enabledTiers!: string[] | null;

  @Column({ name: 'enabled_user_ids', type: 'text', array: true, nullable: true })
  enabledUserIds!: string[] | null;

feature/implement-4-issues
  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true, default: null })
  createdBy!: string | null;
 main
}
