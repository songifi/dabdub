import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Merchant } from '../../database/entities/merchant.entity';


@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Index({ unique: true })
  @Column()
  keyHash: string; // SHA-256 hash of the full key (hex)

  @Column()
  prefix: string; // e.g., "sk_live_" for masked display

  @Column('jsonb', { default: ['stellar:read'] })
  scopes: string[]; // e.g., ["stellar:tx_submit", "stellar:account_manage"]

  @Column('jsonb', { default: [] })
  ipWhitelist: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 1000 }) // Requests per hour limit
  rateLimit: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date;

  @Column({ name: 'merchant_id', nullable: true }) // nullable for existing keys or system keys
  merchantId: string;

  @ManyToOne(() => Merchant, (merchant) => merchant.apiKeys)
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;
}

