import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

/**
 * ReconciliationAlert
 *
 * Created when blockchain data doesn't match database state.
 * Requires admin investigation and remediation.
 */
@Entity('reconciliation_alerts')
@Index('IDX_reconciliation_alerts_user_created_at', { synchronize: false }, ['userId', 'createdAt'])
@Index('IDX_reconciliation_alerts_resolved', { synchronize: false }, ['isResolved'])
export class ReconciliationAlert extends BaseEntity {
  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column()
  discrepancyType!: string; // e.g., 'balance_mismatch', 'missing_transaction'

  @Column()
  message!: string;

  @Column({ type: 'jsonb', nullable: false })
  data!: Record<string, unknown>; // blockchain data vs db data comparison

  @Column({ name: 'is_resolved', default: false })
  isResolved!: boolean;

  @Column({ nullable: true })
  resolvedNote!: string | null;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
