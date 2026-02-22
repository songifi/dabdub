import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { SupportTicket } from './support-ticket.entity';

export enum MessageSender {
  MERCHANT = 'MERCHANT',
  ADMIN = 'ADMIN',
  SYSTEM = 'SYSTEM',
}

export interface TicketAttachment {
  filename: string;
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
}

@Entity('support_ticket_messages')
@Index(['ticketId', 'createdAt'])
@Index(['sender', 'ticketId'])
export class SupportTicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ticketId: string;

  @ManyToOne(() => SupportTicket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticketId' })
  ticket: SupportTicket;

  @Column({
    type: 'enum',
    enum: MessageSender,
  })
  sender: MessageSender;

  @Column({ nullable: true })
  adminId: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({
    type: 'jsonb',
    default: () => '[]',
  })
  attachments: TicketAttachment[];

  @Column({ type: 'boolean', default: false })
  isInternalNote: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
