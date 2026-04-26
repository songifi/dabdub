import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Singleton admin-storage row for on-chain slippage configuration.
 * key is always 'global' — one row, updated in place.
 */
@Entity('slippage_config')
export class SlippageConfig {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  key: string;

  /** Maximum allowed slippage in basis points (100 = 1%). Default: 100. */
  @Column({ name: 'max_slippage_bps', type: 'int', default: 100 })
  maxSlippageBps: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
