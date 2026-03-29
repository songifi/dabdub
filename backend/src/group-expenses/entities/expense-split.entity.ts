import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { GroupExpense } from './group-expense.entity';

@Entity('expense_splits')
export class ExpenseSplit extends BaseEntity {
  @Index()
  @Column({ name: 'expense_id', type: 'uuid' })
  expenseId!: string;

  @ManyToOne(() => GroupExpense, (expense) => expense.splits, { onDelete: 'CASCADE' })
  expense: GroupExpense;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'amount_owed', type: 'varchar' })
  amountOwed!: string;

  @Column({ name: 'amount_paid', type: 'varchar', default: '0' })
  amountPaid!: string;

  @Column({ name: 'is_paid', type: 'boolean', default: false })
  isPaid!: boolean;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt?: Date;

  @Column({ name: 'tx_hash', type: 'varchar', nullable: true })
  txHash?: string;
}
