import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class Audit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'admin_id' })
  adminId!: string;

  @Column()
  action!: string;

  @Column({ type: 'jsonb', nullable: true })
  detail: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
