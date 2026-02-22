import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';

@Entity('merchant_ip_allowlists')
export class MerchantIpAllowlist extends BaseEntity {
  @Column()
  merchantId: string;

  @Column()
  cidr: string; // e.g., '192.168.1.0/24' or '203.0.113.42/32'

  @Column()
  label: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column()
  createdById: string;

  @Column({ nullable: true })
  removedById: string | null;
}
