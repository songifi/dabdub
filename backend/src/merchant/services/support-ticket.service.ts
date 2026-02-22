import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import {
  SupportTicket,
  TicketStatus,
  TicketPriority,
} from '../entities/support-ticket.entity';
import {
  SupportTicketMessage,
  MessageSender,
} from '../entities/support-ticket-message.entity';
import { Merchant } from '../../database/entities/merchant.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import {
  CreateSupportTicketDto,
  UpdateTicketDto,
  ReplyToTicketDto,
  ResolveTicketDto,
  EscalateTicketDto,
  SupportTicketResponseDto,
  SupportTicketListResponseDto,
  SupportStatsDto,
} from '../dto/support-ticket.dto';

const SLA_THRESHOLDS = {
  URGENT: 60, // 1 hour in minutes
  HIGH: 240, // 4 hours in minutes
  NORMAL: 1440, // 24 hours in minutes
  LOW: 2880, // 48 hours in minutes
};

@Injectable()
export class SupportTicketService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepository: Repository<SupportTicket>,
    @InjectRepository(SupportTicketMessage)
    private readonly messageRepository: Repository<SupportTicketMessage>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
  ) {}

  async createTicket(
    merchantId: string,
    dto: CreateSupportTicketDto,
  ): Promise<SupportTicketResponseDto> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    // Generate ticket number
    const ticketNumber = await this.generateTicketNumber();

    const ticket = this.ticketRepository.create({
      ticketNumber,
      merchantId,
      category: dto.category,
      priority: dto.priority || TicketPriority.NORMAL,
      status: TicketStatus.OPEN,
      subject: dto.subject,
      relatedTransactionId: dto.relatedTransactionId || null,
      relatedSettlementId: dto.relatedSettlementId || null,
      merchantLastReplyAt: new Date(),
    });

    const savedTicket = await this.ticketRepository.save(ticket);

    // Create initial message from merchant
    const message = this.messageRepository.create({
      ticketId: savedTicket.id,
      sender: MessageSender.MERCHANT,
      body: dto.body,
      isInternalNote: false,
    });
    await this.messageRepository.save(message);

    // Update message count
    savedTicket.messageCount = 1;
    await this.ticketRepository.save(savedTicket);

    // Queue notification to admins
    await this.notifyAdminsNewTicket(savedTicket, merchant);

    return this.mapToResponseDto(savedTicket, merchant, [message]);
  }

  async listTickets(
    filters: {
      status?: TicketStatus;
      priority?: TicketPriority;
      category?: string;
      assignedToId?: string;
      merchantId?: string;
      createdAfter?: Date;
      createdBefore?: Date;
      hasUnreadReplies?: boolean;
    } = {},
  ): Promise<SupportTicketListResponseDto[]> {
    let query = this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.merchant', 'merchant')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo');

    if (filters.status) {
      query = query.andWhere('ticket.status = :status', {
        status: filters.status,
      });
    }

    if (filters.priority) {
      query = query.andWhere('ticket.priority = :priority', {
        priority: filters.priority,
      });
    }

    if (filters.category) {
      query = query.andWhere('ticket.category = :category', {
        category: filters.category,
      });
    }

    if (filters.assignedToId) {
      query = query.andWhere('ticket.assignedToId = :assignedToId', {
        assignedToId: filters.assignedToId,
      });
    }

    if (filters.merchantId) {
      query = query.andWhere('ticket.merchantId = :merchantId', {
        merchantId: filters.merchantId,
      });
    }

    if (filters.createdAfter) {
      query = query.andWhere('ticket.createdAt >= :createdAfter', {
        createdAfter: filters.createdAfter,
      });
    }

    if (filters.createdBefore) {
      query = query.andWhere('ticket.createdAt <= :createdBefore', {
        createdBefore: filters.createdBefore,
      });
    }

    if (filters.hasUnreadReplies) {
      // Unread replies: merchantLastReplyAt > adminLastReplyAt
      query = query.andWhere(
        'ticket.merchantLastReplyAt > ticket.adminLastReplyAt OR ticket.adminLastReplyAt IS NULL',
      );
    }

    const tickets = await query
      .orderBy('ticket.priority', 'DESC')
      .addOrderBy('ticket.merchantLastReplyAt', 'ASC')
      .getMany();

    return tickets.map((ticket) => ({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      merchantId: ticket.merchantId,
      merchantName: ticket.merchant.name,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      subject: ticket.subject,
      assignedToId: ticket.assignedToId,
      assignedToEmail: ticket.assignedTo?.email || null,
      messageCount: ticket.messageCount,
      merchantLastReplyAt: ticket.merchantLastReplyAt,
      adminLastReplyAt: ticket.adminLastReplyAt,
      firstResponseAt: ticket.firstResponseAt,
      resolvedAt: ticket.resolvedAt,
      createdAt: ticket.createdAt,
    }));
  }

  async getTicketDetail(ticketId: string): Promise<SupportTicketResponseDto> {
    const ticket = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.merchant', 'merchant')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
      .where('ticket.id = :ticketId', { ticketId })
      .getOne();

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    const messages = await this.messageRepository.find({
      where: { ticketId },
      order: { createdAt: 'ASC' },
    });

    return this.mapToResponseDto(ticket, ticket.merchant, messages);
  }

  async updateTicket(
    ticketId: string,
    dto: UpdateTicketDto,
  ): Promise<SupportTicketResponseDto> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    if (dto.status !== undefined) {
      ticket.status = dto.status;
    }

    if (dto.priority !== undefined) {
      ticket.priority = dto.priority;
    }

    if (dto.assignedToId !== undefined) {
      if (dto.assignedToId) {
        const admin = await this.userRepository.findOne({
          where: { id: dto.assignedToId },
        });
        if (!admin) {
          throw new NotFoundException('Admin user not found');
        }
      }
      ticket.assignedToId = dto.assignedToId || null;
    }

    if (dto.relatedTransactionId !== undefined) {
      ticket.relatedTransactionId = dto.relatedTransactionId;
    }

    if (dto.relatedSettlementId !== undefined) {
      ticket.relatedSettlementId = dto.relatedSettlementId;
    }

    const updatedTicket = await this.ticketRepository.save(ticket);

    const merchant = await this.merchantRepository.findOne({
      where: { id: ticket.merchantId },
    });

    const messages = await this.messageRepository.find({
      where: { ticketId },
    });

    return this.mapToResponseDto(updatedTicket, merchant, messages);
  }

  async replyToTicket(
    ticketId: string,
    adminId: string,
    dto: ReplyToTicketDto,
  ): Promise<SupportTicketResponseDto> {
    const ticket = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.merchant', 'merchant')
      .where('ticket.id = :ticketId', { ticketId })
      .getOne();

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    // Create message
    const message = this.messageRepository.create({
      ticketId,
      sender: MessageSender.ADMIN,
      adminId,
      body: dto.body,
      isInternalNote: dto.isInternalNote,
    });
    await this.messageRepository.save(message);

    // Update ticket message count
    ticket.messageCount += 1;

    // Set first response time if this is the first admin reply
    if (!ticket.firstResponseAt) {
      ticket.firstResponseAt = new Date();
      const createdAtMs = ticket.createdAt.getTime();
      const responseAtMs = ticket.firstResponseAt.getTime();
      ticket.firstResponseTimeMinutes = Math.round(
        (responseAtMs - createdAtMs) / 60000,
      );
    }

    // Update admin last reply
    ticket.adminLastReplyAt = new Date();

    // If not internal note, update status and send email
    if (!dto.isInternalNote) {
      ticket.status = TicketStatus.AWAITING_MERCHANT;

      // Queue email to merchant
      await this.queueMerchantReplyEmail(ticket, message);
    }

    const updatedTicket = await this.ticketRepository.save(ticket);

    const messages = await this.messageRepository.find({
      where: { ticketId },
      order: { createdAt: 'ASC' },
    });

    return this.mapToResponseDto(updatedTicket, ticket.merchant, messages);
  }

  async resolveTicket(
    ticketId: string,
    adminId: string,
    dto: ResolveTicketDto,
  ): Promise<SupportTicketResponseDto> {
    const ticket = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.merchant', 'merchant')
      .where('ticket.id = :ticketId', { ticketId })
      .getOne();

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    // Create system message for resolution
    const message = this.messageRepository.create({
      ticketId,
      sender: MessageSender.SYSTEM,
      body: `Ticket resolved. Admin notes: ${dto.resolutionNote}`,
      isInternalNote: false,
    });
    await this.messageRepository.save(message);

    ticket.messageCount += 1;
    ticket.status = TicketStatus.RESOLVED;
    ticket.resolvedAt = new Date();

    if (ticket.createdAt) {
      const createdAtMs = ticket.createdAt.getTime();
      const resolvedAtMs = ticket.resolvedAt.getTime();
      ticket.resolutionTimeMinutes = Math.round(
        (resolvedAtMs - createdAtMs) / 60000,
      );
    }

    ticket.adminLastReplyAt = new Date();

    const updatedTicket = await this.ticketRepository.save(ticket);

    // Queue resolution email to merchant
    await this.queueResolutionEmail(updatedTicket, ticket.merchant);

    const messages = await this.messageRepository.find({
      where: { ticketId },
      order: { createdAt: 'ASC' },
    });

    return this.mapToResponseDto(updatedTicket, ticket.merchant, messages);
  }

  async escalateTicket(
    ticketId: string,
    dto: EscalateTicketDto,
  ): Promise<SupportTicketResponseDto> {
    const ticket = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.merchant', 'merchant')
      .where('ticket.id = :ticketId', { ticketId })
      .getOne();

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    // Verify assignee exists
    const assignee = await this.userRepository.findOne({
      where: { id: dto.assignToId },
    });
    if (!assignee) {
      throw new NotFoundException('Admin user not found');
    }

    // Create escalation message
    const message = this.messageRepository.create({
      ticketId,
      sender: MessageSender.SYSTEM,
      body: `Ticket escalated. Escalation notes: ${dto.escalationNote}`,
      isInternalNote: true,
    });
    await this.messageRepository.save(message);

    ticket.messageCount += 1;
    ticket.priority = TicketPriority.URGENT;
    ticket.status = TicketStatus.ESCALATED;
    ticket.assignedToId = dto.assignToId;
    ticket.adminLastReplyAt = new Date();

    const updatedTicket = await this.ticketRepository.save(ticket);

    // Queue escalation email to new assignee
    await this.queueEscalationEmail(updatedTicket, assignee, ticket.merchant);

    const messages = await this.messageRepository.find({
      where: { ticketId },
      order: { createdAt: 'ASC' },
    });

    return this.mapToResponseDto(updatedTicket, ticket.merchant, messages);
  }

  async getStats(): Promise<SupportStatsDto> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const tickets = await this.ticketRepository.find({
      where: {
        createdAt: MoreThan(thirtyDaysAgo),
      },
    });

    const totalTickets = tickets.length;
    const openTickets = tickets.filter(
      (t) =>
        t.status === TicketStatus.OPEN || t.status === TicketStatus.IN_PROGRESS,
    ).length;
    const resolvedTickets = tickets.filter(
      (t) => t.status === TicketStatus.RESOLVED,
    ).length;
    const escalatedTickets = tickets.filter(
      (t) => t.status === TicketStatus.ESCALATED,
    ).length;

    // Calculate SLA metrics
    const responseTimes = tickets
      .filter((t) => t.firstResponseTimeMinutes !== null)
      .map((t) => t.firstResponseTimeMinutes);
    const resolutionTimes = tickets
      .filter((t) => t.resolutionTimeMinutes !== null)
      .map((t) => t.resolutionTimeMinutes);

    const averageFirstResponseTimeMinutes =
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
          )
        : 0;

    const averageResolutionTimeMinutes =
      resolutionTimes.length > 0
        ? Math.round(
            resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length,
          )
        : 0;

    // Categorize by category
    const byCategory = Object.values(TicketCategory).reduce(
      (acc, cat) => {
        acc[cat] = tickets.filter((t) => t.category === cat).length;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Categorize by priority
    const byPriority = Object.values(TicketPriority).reduce(
      (acc, pri) => {
        acc[pri] = tickets.filter((t) => t.priority === pri).length;
        return acc;
      },
      {} as Record<string, number>,
    );

    // SLA breaches
    const firstResponseSlaBreaches = tickets.filter((t) => {
      if (!t.firstResponseAt || !t.firstResponseTimeMinutes) return false;
      const threshold = SLA_THRESHOLDS[t.priority] || 1440;
      return t.firstResponseTimeMinutes > threshold;
    }).length;

    const resolutionSlaBreaches = tickets.filter((t) => {
      if (!t.resolvedAt || !t.resolutionTimeMinutes) return false;
      const threshold = SLA_THRESHOLDS[t.priority] || 1440;
      return t.resolutionTimeMinutes > threshold;
    }).length;

    // Agent performance
    const agentPerformance = await this.getAgentPerformance(thirtyDaysAgo);

    return {
      last30d: {
        totalTickets,
        openTickets,
        resolvedTickets,
        escalatedTickets,
        averageFirstResponseTimeMinutes,
        averageResolutionTimeMinutes,
        byCategory,
        byPriority,
        firstResponseSlaBreaches,
        resolutionSlaBreaches,
      },
      agentPerformance,
    };
  }

  private async getAgentPerformance(since: Date) {
    const agents = await this.userRepository.find({
      where: {
        role: UserRole.SUPER_ADMIN, // or any admin role
      },
    });

    const performance = [];

    for (const agent of agents) {
      const agentTickets = await this.ticketRepository.find({
        where: {
          assignedToId: agent.id,
          createdAt: MoreThan(since),
        },
      });

      if (agentTickets.length === 0) continue;

      const responseTimes = agentTickets
        .filter((t) => t.firstResponseTimeMinutes !== null)
        .map((t) => t.firstResponseTimeMinutes);

      const resolutionTimes = agentTickets
        .filter((t) => t.resolutionTimeMinutes !== null)
        .map((t) => t.resolutionTimeMinutes);

      performance.push({
        admin: {
          id: agent.id,
          email: agent.email,
        },
        ticketsHandled: agentTickets.length,
        avgFirstResponseMinutes:
          responseTimes.length > 0
            ? Math.round(
                responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
              )
            : null,
        avgResolutionMinutes:
          resolutionTimes.length > 0
            ? Math.round(
                resolutionTimes.reduce((a, b) => a + b, 0) /
                  resolutionTimes.length,
              )
            : null,
        satisfactionScore: null, // To be implemented with survey data
      });
    }

    return performance;
  }

  private async generateTicketNumber(): Promise<string> {
    // Simple implementation: query the last ticket and increment
    const lastTicket = await this.ticketRepository
      .createQueryBuilder('ticket')
      .orderBy('ticket.createdAt', 'DESC')
      .take(1)
      .getOne();

    let nextNumber = 1;
    if (lastTicket && lastTicket.ticketNumber) {
      const match = lastTicket.ticketNumber.match(/CHZ-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `CHZ-${String(nextNumber).padStart(5, '0')}`;
  }

  private async notifyAdminsNewTicket(
    ticket: SupportTicket,
    merchant: Merchant,
  ) {
    try {
      await this.notificationQueue.add(
        'send-email',
        {
          to: 'support@cheese.io', // or fetch support admin emails
          subject: `New Support Ticket: ${ticket.ticketNumber} - ${ticket.subject}`,
          template: 'new-support-ticket',
          data: {
            ticketNumber: ticket.ticketNumber,
            merchantName: merchant.name,
            category: ticket.category,
            priority: ticket.priority,
            subject: ticket.subject,
            ticketUrl: `https://admin.cheese.io/support/tickets/${ticket.id}`,
          },
        },
        { removeOnComplete: true, removeOnFail: false },
      );
    } catch (error) {
      console.error('Failed to queue admin notification:', error);
    }
  }

  private async queueMerchantReplyEmail(
    ticket: SupportTicket,
    message: SupportTicketMessage,
  ) {
    const merchant = await this.merchantRepository.findOne({
      where: { id: ticket.merchantId },
    });
    if (!merchant) return;

    try {
      await this.notificationQueue.add(
        'send-email',
        {
          to: merchant.email,
          subject: `RE: Support Ticket ${ticket.ticketNumber} - ${ticket.subject}`,
          template: 'support-ticket-reply',
          data: {
            ticketNumber: ticket.ticketNumber,
            merchantName: merchant.name,
            messageBody: message.body,
            ticketUrl: `https://merchant.cheese.io/support/tickets/${ticket.id}`,
          },
        },
        { removeOnComplete: true, removeOnFail: false },
      );
    } catch (error) {
      console.error('Failed to queue merchant reply email:', error);
    }
  }

  private async queueResolutionEmail(
    ticket: SupportTicket,
    merchant: Merchant,
  ) {
    try {
      await this.notificationQueue.add(
        'send-email',
        {
          to: merchant.email,
          subject: `RESOLVED: Support Ticket ${ticket.ticketNumber} - ${ticket.subject}`,
          template: 'support-ticket-resolved',
          data: {
            ticketNumber: ticket.ticketNumber,
            merchantName: merchant.name,
            resolutionTimeMinutes: ticket.resolutionTimeMinutes,
            ticketUrl: `https://merchant.cheese.io/support/tickets/${ticket.id}`,
          },
        },
        { removeOnComplete: true, removeOnFail: false },
      );
    } catch (error) {
      console.error('Failed to queue resolution email:', error);
    }
  }

  private async queueEscalationEmail(
    ticket: SupportTicket,
    assignee: UserEntity,
    merchant: Merchant,
  ) {
    try {
      await this.notificationQueue.add(
        'send-email',
        {
          to: assignee.email,
          subject: `ESCALATED: Support Ticket ${ticket.ticketNumber} - ${ticket.subject}`,
          template: 'support-ticket-escalated',
          data: {
            ticketNumber: ticket.ticketNumber,
            merchantName: merchant.name,
            assigneeName: assignee.email.split('@')[0],
            ticketUrl: `https://admin.cheese.io/support/tickets/${ticket.id}`,
          },
        },
        { removeOnComplete: true, removeOnFail: false },
      );
    } catch (error) {
      console.error('Failed to queue escalation email:', error);
    }
  }

  private mapToResponseDto(
    ticket: SupportTicket,
    merchant: Merchant,
    messages: SupportTicketMessage[],
  ): SupportTicketResponseDto {
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      merchantId: ticket.merchantId,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
      },
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      subject: ticket.subject,
      assignedToId: ticket.assignedToId,
      assignedTo: ticket.assignedTo
        ? {
            id: ticket.assignedTo.id,
            email: ticket.assignedTo.email,
          }
        : null,
      relatedTransactionId: ticket.relatedTransactionId,
      relatedSettlementId: ticket.relatedSettlementId,
      firstResponseAt: ticket.firstResponseAt,
      resolvedAt: ticket.resolvedAt,
      firstResponseTimeMinutes: ticket.firstResponseTimeMinutes,
      resolutionTimeMinutes: ticket.resolutionTimeMinutes,
      messageCount: ticket.messageCount,
      merchantLastReplyAt: ticket.merchantLastReplyAt,
      adminLastReplyAt: ticket.adminLastReplyAt,
      messages: messages.map((m) => ({
        id: m.id,
        ticketId: m.ticketId,
        sender: m.sender,
        adminId: m.adminId,
        body: m.body,
        attachments: m.attachments,
        isInternalNote: m.isInternalNote,
        createdAt: m.createdAt,
      })),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }
}

// Import for TicketCategory
import { TicketCategory } from '../entities/support-ticket.entity';
