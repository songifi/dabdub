import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { TokenConfig } from './token-config.entity';

@Entity('blockchain_configs')
@Index(['chainId'], { unique: true })
export class BlockchainConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'chain_id', type: 'varchar', length: 50, unique: true })
  chainId!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName!: string;

  @Column({ name: 'rpc_url', type: 'text' })
  rpcUrl!: string;

  @Column({ name: 'fallback_rpc_url', type: 'text', nullable: true })
  fallbackRpcUrl!: string | null;

  @Column({ name: 'explorer_url', type: 'varchar', length: 255 })
  explorerUrl!: string;

  @Column({ name: 'required_confirmations', type: 'int', default: 12 })
  requiredConfirmations!: number;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled!: boolean;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'online',
  })
  status!: string;

  @Column({ name: 'native_currency_symbol', type: 'varchar', length: 10 })
  nativeCurrencySymbol!: string;

  @Column({ name: 'native_currency_decimals', type: 'int', default: 18 })
  nativeCurrencyDecimals!: number;

  @Column({ name: 'priority', type: 'int', default: 0 })
  priority!: number;

  @OneToMany(() => TokenConfig, (token) => token.blockchainConfig)
  tokens!: TokenConfig[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
