import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * Daily balance snapshot for historical chart data.
 * Stored once per day per user to enable 30-day balance history.
 */
@Entity('balance_snapshots')
@Index(['userId', 'snapshotDate'], { unique: true })
export class BalanceSnapshot extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  /** Snapshot date (midnight UTC) */
  @Column({ name: 'snapshot_date', type: 'date' })
  snapshotDate!: string;

  /** Liquid USDC balance at snapshot time */
  @Column({ name: 'balance_usdc', type: 'numeric', precision: 24, scale: 8 })
  balanceUsdc!: string;

  /** Staked USDC balance at snapshot time */
  @Column({ name: 'staked_balance_usdc', type: 'numeric', precision: 24, scale: 8 })
  stakedBalanceUsdc!: string;

  /** Total USDC balance at snapshot time */
  @Column({ name: 'total_usdc', type: 'numeric', precision: 24, scale: 8 })
  totalUsdc!: string;

  /** USDC/NGN rate at snapshot time */
  @Column({ name: 'rate', type: 'numeric', precision: 24, scale: 8 })
  rate!: string;
}
