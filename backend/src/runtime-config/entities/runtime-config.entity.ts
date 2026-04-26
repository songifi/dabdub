import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('runtime_config')
export class RuntimeConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  key!: string;

  @Column({ type: 'jsonb' })
  value: any;

  @Column({ nullable: true })
  description?: string;

  @Column({ name: 'updated_by' })
  updatedBy!: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
