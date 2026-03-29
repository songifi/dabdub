import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { TicketMessage } from './ticket-message.entity';

export enum TicketCategory {
  TRANSACTION = 'transaction',
  ACCOUNT = 'account',
  KYC = 'kyc',
  WITHDRAWAL = 'withdrawal',
  GENERAL = 'general',
  DISPUTE = 'dispute',
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum SenderType {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('support_ticket')
@Index(['status', 'priority', 'createdAt'])
@Index('idx_ticket_user', ['userId'])
@Index('idx_ticket_transaction', ['transactionId'])
export class SupportTicket extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'ticket_number', unique: true })
  ticketNumber!: string;

  @Column({
    type: 'enum',
    enum: TicketCategory,
  })
  category!: TicketCategory;

  @Column({ length: 100 })
  subject!: string;

  @Column('text')
  description!: string;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.OPEN,
  })
  status!: TicketStatus;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.MEDIUM,
  })
  priority!: TicketPriority;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo!: string | null;

  @Column({ name: 'transaction_id', nullable: true })
  transactionId!: string | null;

  @ManyToOne(() => Transaction, { nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction?: Transaction;

  @Column({ name: 'dispute_id', type: 'uuid', nullable: true, default: null })
  disputeId!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @OneToMany(() => TicketMessage, (message) => message.ticket)
  messages!: TicketMessage[];
}

