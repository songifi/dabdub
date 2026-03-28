import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('app_configs')
export class AppConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 100 })
  key!: string;

  @Column({ type: 'jsonb' })
  value!: unknown;

  @Column({ length: 255, nullable: true, default: null })
  description!: string | null;

  @Column({ name: 'updated_by', nullable: true, default: null })
  updatedBy!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
