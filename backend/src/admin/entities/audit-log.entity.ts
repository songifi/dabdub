import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  actor: string; // user id or name

  @Column()
  action: string;

  @Column()
  resourceType: string;

  @Column({ nullable: true })
  resourceId: string;

  @Column({ type: 'jsonb', nullable: true })
  details: any;

  @CreateDateColumn()
  createdAt: Date;
}