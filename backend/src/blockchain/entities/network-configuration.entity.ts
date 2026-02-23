import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum NetworkStatus {
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  DEPRECATED = 'deprecated',
}

@Entity('network_configs')
@Index(['network'])
@Index(['status'])
@Index(['isActive'])
export class NetworkConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'network', type: 'varchar', length: 100, unique: true })
  network: string;

  @Column({ name: 'rpc_url', type: 'text' })
  rpcUrl: string;

  @Column({ name: 'chain_id', type: 'int' })
  chainId: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'block_time', type: 'int', nullable: true })
  blockTime: number | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: NetworkStatus,
    enumName: 'network_status_enum',
    default: NetworkStatus.ACTIVE,
  })
  status: NetworkStatus;

  @Column({
    name: 'usdc_contract_address',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  usdcContractAddress: string | null;

  @Column({
    name: 'settlement_contract_address',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  settlementContractAddress: string | null;

  @Column({ name: 'required_confirmations', type: 'int', default: 12 })
  requiredConfirmations: number;

  @Column({
    name: 'current_gas_price',
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  currentGasPrice: number | null;

  @Column({
    name: 'max_gas_price',
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  maxGasPrice: number | null;

  @Column({ name: 'last_block_number', type: 'int', nullable: true })
  lastBlockNumber: number | null;

  @Column({ name: 'last_health_check', type: 'timestamp', nullable: true })
  lastHealthCheck: Date | null;

  @Column({ name: 'is_healthy', type: 'boolean', default: true })
  isHealthy: boolean;

  @Column({ name: 'fallback_rpc_urls', type: 'simple-array', nullable: true })
  fallbackRpcUrls: string[] | null;

  @Column({ name: 'last_scanned_block', type: 'int', nullable: true })
  lastScannedBlock: number | null;

  @Column({
    name: 'base_fee_per_gas',
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  baseFeePerGas: number | null;

  @Column({
    name: 'priority_fee_per_gas',
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  priorityFeePerGas: number | null;

  @Column({ name: 'network_settings', type: 'jsonb', nullable: true })
  networkSettings: Record<string, unknown> | null;

  @Column({ name: 'supports_eip1559', type: 'boolean', default: false })
  supportsEIP1559: boolean;

  @Column({ name: 'supports_flashbots', type: 'boolean', default: false })
  supportsFlashbots: boolean;

  @Column({ name: 'supports_erc20', type: 'boolean', default: true })
  supportsERC20: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
