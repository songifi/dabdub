import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
  Index,
} from "typeorm";

@Entity("token_configs")
@Index(["chainId", "tokenAddress"], { unique: true })
export class TokenConfig extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  chainId: string;

  @Column()
  tokenAddress: string; // '0x...' or 'native'

  @Column()
  symbol: string; // 'USDC', 'ETH', 'MATIC'

  @Column()
  name: string;

  @Column({ type: "int" })
  decimals: number;

  @Column({ type: "boolean", default: true })
  isEnabled: boolean;

  @Column({ type: "boolean", default: false })
  isNative: boolean;

  @Column({ type: "decimal", precision: 20, scale: 8 })
  minimumAcceptedAmount: number;

  @Column({ type: "decimal", precision: 20, scale: 8, nullable: true })
  maximumAcceptedAmount: number | null;

  @Column({ nullable: true })
  coingeckoId: string | null; // for price feeds

  @Column({ type: "int", default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
