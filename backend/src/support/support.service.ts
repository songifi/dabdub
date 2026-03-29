import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuid } from 'uuid';
import { User } from '../users/entities/user.entity';
import { NotificationType } from '../notifications/notifications.types';
import { Transaction, TransactionStatus } from '../transactions/entities/transaction.entity';
import { SupportTicket, TicketCategory, TicketPriority } from './entities/support-ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AddMessageDto } from './dto/add-message.dto';
import { TicketResponseDto } from './dto/ticket-response.dto';
import { AdminTicketQueryDto } from './dto/admin-ticket-query.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

export const SUPPORT_QUEUE = 'support-jobs';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(TicketMessage)
    private readonly messageRepo: Repository<TicketMessage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
    private readonly usersService: UsersService,
  ) {}

  async createTicket(userId: string, dto: CreateTicketDto): Promise<TicketResponseDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let priority: TicketPriority = TicketPriority.MEDIUM;
    if (dto.category === TicketCategory.TRANSACTION && dto.transactionId) {
      const tx = await this.txRepo.findOne({
        where: {
          id: dto.transactionId,
          userId,
          status: TransactionStatus.PENDING,
          createdAt: LessThanOrEqual(new Date(Date.now() - 60 * 60 * 1000)), // >1h
        },
      });
      if (tx) priority = TicketPriority.URGENT;
    }

    const ticketNumber = this.generateTicketNumber();
    const ticket = this.ticketRepo.create({
      userId,
      ticketNumber,
      category: dto.category,
      subject: dto.subject,
      description: dto.description,
      priority,
      transactionId: dto.transactionId || null,
    });

    const saved = await this.ticketRepo.save(ticket);

    // Send confirmation email
    await this.emailService.queue(
      user.email,
      'SUPPORT_TICKET_CONFIRMATION',
      {
        ticketNumber: saved.ticketNumber,
        subject: saved.subject,
        supportUrl: `${process.env.FRONTEND_URL}/support/${saved.id}`,
      },
      userId,
    );

    // User notification
    await this.notificationService.create(
      userId,
      NotificationType.SYSTEM,
      `Ticket ${saved.ticketNumber} created`,
      `Your support ticket has been created successfully.`,
    );

    // Admin notification
    await this.notificationService.create(
      'system-admin', // or query superadmin
      NotificationType.SYSTEM,
      `New ticket ${saved.ticketNumber}`,
      `${user.username || user.email} - ${dto.subject} (${priority})`,
    );

    return new TicketResponseDto(saved);
  }

  /** Auto-created when a user opens a transaction dispute (linked row). */
  async createTicketForDispute(params: {
    userId: string;
    transactionId: string;
    disputeId: string;
    disputeType: string;
    description: string;
  }): Promise<SupportTicket> {
    const ticketNumber = this.generateTicketNumber();
    const ticket = this.ticketRepo.create({
      userId: params.userId,
      ticketNumber,
      category: TicketCategory.DISPUTE,
      subject: `Dispute ${params.disputeId.slice(0, 8)} — ${params.disputeType}`,
      description: `${params.description}\n\n[Dispute ID: ${params.disputeId}]`,
      priority: TicketPriority.HIGH,
      transactionId: params.transactionId,
      disputeId: params.disputeId,
    });
    const saved = await this.ticketRepo.save(ticket);

    await this.notificationService.create(
      'system-admin',
      NotificationType.SYSTEM,
      `New dispute ticket ${saved.ticketNumber}`,
      `User ${params.userId} disputed transaction ${params.transactionId}.`,
      { ticketId: saved.id, disputeId: params.disputeId },
    );

    return saved;
  }

  async listUserTickets(userId: string, query: { limit?: number; cursor?: string }) {
    const limit = Math.min(query.limit ?? 20, 50);
    const qb = this.ticketRepo
      .createQueryBuilder('ticket')
      .where('ticket.user_id = :userId', { userId })
      .orderBy('ticket.createdAt', 'DESC')
      .take(limit + 1);

    const tickets = await qb.getMany();
    // Pagination logic with cursor (simplified)
    return { tickets, hasMore: tickets.length > limit };
  }

  async getUserTicket(userId: string, ticketId: string): Promise<TicketResponseDto> {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId, userId },
      relations: ['messages'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return new TicketResponseDto(ticket);
  }

  async addMessage(userId: string, ticketId: string, dto: AddMessageDto): Promise<TicketResponseDto> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId, userId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const message = this.messageRepo.create({
      ticketId,
      senderId: userId,
      senderType: 'user',
      message: dto.message,
      attachmentKey: dto.attachmentKey || null,
    });

    const savedMessage = await this.messageRepo.save(message);

    // Notify admin
    await this.notificationService.create(
      'system-admin',
      'support_new_message',
      `New message on ${ticket.ticketNumber}`,
      `User added message to ticket.`,
    );

    // Refresh ticket with messages
    const updatedTicket = await this.ticketRepo.findOne({
      where: { id: ticketId },
      relations: ['messages'],
    });
    if (!updatedTicket) throw new NotFoundException('Ticket not found');

    return new TicketResponseDto(updatedTicket);
  }

  async listAllTickets(query: AdminTicketQueryDto) {
    const qb = this.ticketRepo.createQueryBuilder('ticket');
    if (query.status) qb.andWhere('ticket.status = :status', { status: query.status });
    if (query.priority) qb.andWhere('ticket.priority = :priority', { priority: query.priority });
    if (query.category) qb.andWhere('ticket.category = :category', { category: query.category });
    if (query.assignedTo) qb.andWhere('ticket.assignedTo = :assignedTo', { assignedTo: query.assignedTo });
    qb.orderBy('ticket.createdAt', 'DESC').take(query.limit || 20);
    const tickets = await qb.getMany();
    return { tickets };
  }

  async updateTicket(id: string, dto: UpdateTicketDto): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (dto.status === TicketStatusEnum.RESOLVED || dto.status === TicketStatusEnum.CLOSED) {
      ticket.resolvedAt = new Date();
    }

    Object.assign(ticket, dto);
    return this.ticketRepo.save(ticket);
  }

  private generateTicketNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `CHZ-${dateStr}-${seq}`;
  }
}

