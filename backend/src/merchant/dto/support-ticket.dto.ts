import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  MinLength,
  IsBoolean,
} from 'class-validator';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../entities/support-ticket.entity';
import {
  MessageSender,
  TicketAttachment,
} from '../entities/support-ticket-message.entity';

export class CreateSupportTicketDto {
  @IsEnum(TicketCategory)
  category: TicketCategory;

  @IsString()
  @MinLength(10)
  subject: string;

  @IsString()
  @MinLength(5)
  body: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsUUID()
  relatedTransactionId?: string;

  @IsOptional()
  @IsUUID()
  relatedSettlementId?: string;
}

export class UpdateTicketDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsUUID()
  assignedToId?: string | null;

  @IsOptional()
  @IsUUID()
  relatedTransactionId?: string;

  @IsOptional()
  @IsUUID()
  relatedSettlementId?: string;
}

export class ReplyToTicketDto {
  @IsString()
  @MinLength(5)
  body: string;

  @IsBoolean()
  isInternalNote: boolean;
}

export class ResolveTicketDto {
  @IsString()
  @MinLength(5)
  resolutionNote: string;
}

export class EscalateTicketDto {
  @IsString()
  @MinLength(5)
  escalationNote: string;

  @IsUUID()
  assignToId: string;
}

export class TicketAttachmentDto {
  filename: string;
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
}

export class SupportTicketMessageResponseDto {
  id: string;
  ticketId: string;
  sender: MessageSender;
  adminId: string | null;
  body: string;
  attachments: TicketAttachment[];
  isInternalNote: boolean;
  createdAt: Date;
}

export class SupportTicketResponseDto {
  id: string;
  ticketNumber: string;
  merchantId: string;
  merchant: {
    id: string;
    name: string;
    email: string;
  };
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  assignedToId: string | null;
  assignedTo: {
    id: string;
    email: string;
  } | null;
  relatedTransactionId: string | null;
  relatedSettlementId: string | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  firstResponseTimeMinutes: number | null;
  resolutionTimeMinutes: number | null;
  messageCount: number;
  merchantLastReplyAt: Date | null;
  adminLastReplyAt: Date | null;
  messages: SupportTicketMessageResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

export class SupportTicketListResponseDto {
  id: string;
  ticketNumber: string;
  merchantId: string;
  merchantName: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  assignedToId: string | null;
  assignedToEmail: string | null;
  messageCount: number;
  merchantLastReplyAt: Date | null;
  adminLastReplyAt: Date | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export class SupportStatsDto {
  last30d: {
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    escalatedTickets: number;
    averageFirstResponseTimeMinutes: number;
    averageResolutionTimeMinutes: number;
    byCategory: Record<TicketCategory, number>;
    byPriority: Record<TicketPriority, number>;
    firstResponseSlaBreaches: number;
    resolutionSlaBreaches: number;
  };
  agentPerformance: AgentPerformanceDto[];
}

export class AgentPerformanceDto {
  admin: {
    id: string;
    email: string;
  };
  ticketsHandled: number;
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  satisfactionScore: number | null;
}
