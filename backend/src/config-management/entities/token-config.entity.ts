import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BlockchainConfig } from './blockchain-config.entity';

@Entity('token_configs')
@Index(['chainId', 'tokenAddress'], { unique: true })
export class TokenConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'chain_id', type: 'varchar', length: 50 })
  chainId!: string;

  @ManyToOne(() => BlockchainConfig, { nullable: false })
  @JoinColumn({ name: 'chain_id', referencedColumnName: 'chainId' })
  blockchainConfig!: BlockchainConfig;

  @Column({ name: 'token_address', type: 'varchar', length: 100 })
  tokenAddress!: string;

  @Column({ name: 'symbol', type: 'varchar', length: 20 })
  symbol!: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'decimals', type: 'int' })
  decimals!: number;

  @Column({ name: 'logo_url', type: 'varchar', length: 255, nullable: true })
  logoUrl!: string | null;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled!: boolean;

  @Column({ name: 'is_stablecoin', type: 'boolean', default: false })
  isStablecoin!: boolean;

  @Column({ name: 'priority', type: 'int', default: 0 })
  priority!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
