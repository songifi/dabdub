import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum SupportTicketStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
}

@Entity('support_tickets')
export class SupportTicket extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'feedback_id' })
  feedbackId!: string;

  @Column({ type: 'varchar', length: 150 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    type: 'enum',
    enum: SupportTicketStatus,
    default: SupportTicketStatus.OPEN,
  })
  status!: SupportTicketStatus;
}