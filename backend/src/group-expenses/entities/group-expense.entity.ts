import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ExpenseSplit } from './expense-split.entity';

export enum GroupExpenseStatus {
  OPEN = 'OPEN',
  PARTIALLY_SETTLED = 'PARTIALLY_SETTLED',
  SETTLED = 'SETTLED',
}

export enum GroupExpenseSplitType {
  EQUAL = 'EQUAL',
  CUSTOM = 'CUSTOM',
  PERCENTAGE = 'PERCENTAGE',
}

@Entity('group_expenses')
export class GroupExpense extends BaseEntity {
  @Index()
  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Index()
  @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
  conversationId?: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @Column({ length: 255 })
  title!: string;

  @Column({ name: 'total_amount', type: 'varchar' })
  totalAmount!: string;

  @Column({ name: 'token_id', type: 'varchar', nullable: true })
  tokenId?: string;

  @Column({ type: 'enum', enum: GroupExpenseSplitType })
  splitType!: GroupExpenseSplitType;

  @Column({ type: 'enum', enum: GroupExpenseStatus, default: GroupExpenseStatus.OPEN })
  status!: GroupExpenseStatus;

  @OneToMany(() => ExpenseSplit, (split) => split.expense, { cascade: true })
  splits: ExpenseSplit[];
}
