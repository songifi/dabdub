import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BlockchainType {
  STELLAR = 'stellar',
  ETHEREUM = 'ethereum',
  POLYGON = 'polygon',
  STACKS = 'stacks',
}

@Entity('blockchain_networks')
export class BlockchainNetwork {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: BlockchainType,
    default: BlockchainType.STELLAR,
  })
  type: BlockchainType;

  @Column({ name: 'rpc_url' })
  rpcUrl: string;

  @Column({ name: 'chain_id', nullable: true })
  chainId: number;

  @Column({ length: 10 })
  symbol: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'monitoring_interval', default: 5000 })
  monitoringInterval: number; // in milliseconds

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
