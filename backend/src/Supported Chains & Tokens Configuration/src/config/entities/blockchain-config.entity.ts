import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
  Index,
} from "typeorm";

@Entity("blockchain_configs")
@Index(["chainId"], { unique: true })
export class BlockchainConfig extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  chainId: string; // 'base', 'ethereum', 'polygon'

  @Column()
  displayName: string;

  @Column()
  rpcUrl: string; // Encrypted at rest

  @Column({ nullable: true })
  fallbackRpcUrl: string | null;

  @Column()
  explorerUrl: string; // base URL, e.g. https://basescan.org

  @Column({ type: "int" })
  requiredConfirmations: number;

  @Column({ type: "boolean", default: true })
  isEnabled: boolean;

  @Column({ type: "boolean", default: false })
  isTestnet: boolean;

  @Column({ type: "int", default: 1 })
  chainIdNumeric: number; // EVM chain ID

  @Column({ type: "decimal", precision: 10, scale: 2 })
  maxGasLimitGwei: number;

  @Column({ type: "int", default: 30 })
  pollingIntervalSeconds: number;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
