import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SupportTicketService } from '../services/support-ticket.service';
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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { UserEntity } from '../../database/entities/user.entity';
import {
  TicketStatus,
  TicketPriority,
} from '../entities/support-ticket.entity';

@ApiTags('Support Tickets')
@Controller('api/v1/support/tickets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SupportTicketController {
  constructor(private readonly ticketService: SupportTicketService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'List support tickets' })
  @ApiResponse({
    status: 200,
    description: 'Tickets retrieved successfully',
    type: [SupportTicketListResponseDto],
  })
  async listTickets(
    @Query('status') status?: TicketStatus,
    @Query('priority') priority?: TicketPriority,
    @Query('category') category?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('merchantId') merchantId?: string,
    @Query('createdAfter') createdAfter?: string,
    @Query('createdBefore') createdBefore?: string,
    @Query('hasUnreadReplies') hasUnreadReplies?: boolean,
  ): Promise<SupportTicketListResponseDto[]> {
    return this.ticketService.listTickets({
      status,
      priority,
      category,
      assignedToId,
      merchantId,
      createdAfter: createdAfter ? new Date(createdAfter) : undefined,
      createdBefore: createdBefore ? new Date(createdBefore) : undefined,
      hasUnreadReplies,
    });
  }

  @Get('stats')
  @UseGuards(PermissionGuard)
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Get support performance metrics' })
  @ApiResponse({
    status: 200,
    description: 'Stats retrieved successfully',
    type: SupportStatsDto,
  })
  async getStats(): Promise<SupportStatsDto> {
    return this.ticketService.getStats();
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'Get ticket detail with message thread' })
  @ApiResponse({
    status: 200,
    description: 'Ticket retrieved successfully',
    type: SupportTicketResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getTicketDetail(
    @Param('id') ticketId: string,
  ): Promise<SupportTicketResponseDto> {
    return this.ticketService.getTicketDetail(ticketId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PermissionGuard)
  @Permissions('merchants:write')
  @ApiOperation({ summary: 'Create a new support ticket' })
  @ApiResponse({
    status: 201,
    description: 'Ticket created successfully',
    type: SupportTicketResponseDto,
  })
  async createTicket(
    @Body() dto: CreateSupportTicketDto,
    @CurrentUser() user: UserEntity,
  ): Promise<SupportTicketResponseDto> {
    // Assume user.merchantId is set for merchant users
    return this.ticketService.createTicket(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'Update ticket metadata' })
  @ApiResponse({
    status: 200,
    description: 'Ticket updated successfully',
    type: SupportTicketResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async updateTicket(
    @Param('id') ticketId: string,
    @Body() dto: UpdateTicketDto,
  ): Promise<SupportTicketResponseDto> {
    return this.ticketService.updateTicket(ticketId, dto);
  }

  @Post(':id/reply')
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'Reply to a support ticket' })
  @ApiResponse({
    status: 200,
    description: 'Reply added successfully',
    type: SupportTicketResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async replyToTicket(
    @Param('id') ticketId: string,
    @Body() dto: ReplyToTicketDto,
    @CurrentUser() user: UserEntity,
  ): Promise<SupportTicketResponseDto> {
    return this.ticketService.replyToTicket(ticketId, user.id, dto);
  }

  @Post(':id/resolve')
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'Resolve a support ticket' })
  @ApiResponse({
    status: 200,
    description: 'Ticket resolved successfully',
    type: SupportTicketResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async resolveTicket(
    @Param('id') ticketId: string,
    @Body() dto: ResolveTicketDto,
    @CurrentUser() user: UserEntity,
  ): Promise<SupportTicketResponseDto> {
    return this.ticketService.resolveTicket(ticketId, user.id, dto);
  }

  @Post(':id/escalate')
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'Escalate a support ticket' })
  @ApiResponse({
    status: 200,
    description: 'Ticket escalated successfully',
    type: SupportTicketResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async escalateTicket(
    @Param('id') ticketId: string,
    @Body() dto: EscalateTicketDto,
  ): Promise<SupportTicketResponseDto> {
    return this.ticketService.escalateTicket(ticketId, dto);
  }
}
