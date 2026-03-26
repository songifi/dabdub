import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('audit_logs')
export class AuditLog extends BaseEntity {
  @Column({ name: 'admin_id' })
  adminId!: string;

  @Column()
  action!: string;

  @Column({ type: 'text' })
  detail!: string;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress!: string | null;
}
