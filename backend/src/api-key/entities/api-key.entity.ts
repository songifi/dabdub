import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Index({ unique: true })
  @Column()
  keyHash: string; // Bcrypt hash of the full key

  @Column()
  prefix: string; // e.g., "st_live_"

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
}