import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Merchant } from '../../database/entities/merchant.entity';
import { UserEntity } from '../../database/entities/user.entity';

export enum TicketCategory {
  TRANSACTION_ISSUE = 'TRANSACTION_ISSUE',
  SETTLEMENT_DELAY = 'SETTLEMENT_DELAY',
  KYC_QUESTION = 'KYC_QUESTION',
  API_INTEGRATION = 'API_INTEGRATION',
  BILLING = 'BILLING',
  OTHER = 'OTHER',
}

export enum TicketPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_MERCHANT = 'AWAITING_MERCHANT',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

@Entity('support_tickets')
@Index(['ticketNumber'], { unique: true })
@Index(['merchantId', 'createdAt'])
@Index(['status', 'priority', 'createdAt'])
@Index(['assignedToId', 'status'])
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  ticketNumber: string; // CHZ-00123

  @Column()
  merchantId: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchantId' })
  merchant: Merchant;

  @Column({
    type: 'enum',
    enum: TicketCategory,
  })
  category: TicketCategory;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.NORMAL,
  })
  priority: TicketPriority;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.OPEN,
  })
  status: TicketStatus;

  @Column()
  subject: string;

  @Column({ nullable: true })
  assignedToId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo: UserEntity | null;

  @Column({ nullable: true })
  relatedTransactionId: string | null;

  @Column({ nullable: true })
  relatedSettlementId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  firstResponseAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  firstResponseTimeMinutes: number | null;

  @Column({ type: 'int', nullable: true })
  resolutionTimeMinutes: number | null;

  @Column({ type: 'int', default: 0 })
  messageCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  merchantLastReplyAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  adminLastReplyAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
