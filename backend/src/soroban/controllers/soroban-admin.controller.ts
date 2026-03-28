import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { Role } from '../../rbac/enums/role.enum';
import { ContractEventListenerService } from '../services/contract-event-listener.service';
import { ContractEventType } from '../entities/contract-event-log.entity';
import { PaginatedContractEventsDto, PaginatedReconciliationAlertsDto } from '../dto/soroban.dto';
import { StellarAssetService } from '../../stellar/stellar-asset.service';

/**
 * SorobanAdminController
 *
 * Admin-only endpoints for monitoring blockchain events and reconciliation.
 * Accessible only to users with ADMIN or SUPER_ADMIN roles.
 */
@ApiTags('Admin - Blockchain Events')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/blockchain', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class SorobanAdminController {
  constructor(
    private readonly contractEventListenerService: ContractEventListenerService,
    private readonly stellarAssetService: StellarAssetService,
  ) {}

  /**
   * GET /admin/blockchain/events
   *
   * List all contract events with optional filtering by event type.
   * Paginated results (default 20 per page).
   *
   * @param page - Page number (starts at 1)
   * @param limit - Items per page (1-100, default 20)
   * @param eventType - Filter by event type (deposit|transfer|paylink_paid|yield_credited|withdrawal)
   */
  @Get('events')
  @ApiOperation({
    summary: 'List contract events',
    description: 'View all Soroban contract events with optional filtering. Admin only.',
  })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20 })
  @ApiQuery({
    name: 'eventType',
    enum: ContractEventType,
    required: false,
    description: 'Filter by specific event type',
  })
  async getContractEvents(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('eventType') eventType?: ContractEventType,
  ): Promise<PaginatedContractEventsDto> {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const { data, total, page: currentPage, limit: currentLimit } =
      await this.contractEventListenerService.getContractEvents(pageNum, limitNum, eventType);

    return {
      data,
      meta: {
        total,
        page: currentPage,
        limit: currentLimit,
        totalPages: Math.ceil(total / currentLimit),
        hasMore: currentPage < Math.ceil(total / currentLimit),
      },
    };
  }

  /**
   * GET /admin/blockchain/reconciliation
   *
   * List reconciliation alerts (balance mismatches, missing records).
   * Shows unresolved alerts by default.
   *
   * @param page - Page number (starts at 1)
   * @param limit - Items per page (1-100, default 20)
   * @param unresolved - Show only unresolved alerts (default true)
   */
  @Get('reconciliation')
  @ApiOperation({
    summary: 'List reconciliation alerts',
    description:
      'View balance mismatches and missing database records detected during event sync. Admin only.',
  })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20 })
  @ApiQuery({
    name: 'unresolved',
    type: Boolean,
    required: false,
    example: true,
    description: 'Show only unresolved alerts',
  })
  async getReconciliationAlerts(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('unresolved') unresolved: string = 'true',
  ): Promise<PaginatedReconciliationAlertsDto> {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const unresolvedFlag = unresolved !== 'false';

    const { data, total, page: currentPage, limit: currentLimit } =
      await this.contractEventListenerService.getReconciliationAlerts(
        pageNum,
        limitNum,
        unresolvedFlag,
      );

    return {
      data,
      meta: {
        total,
        page: currentPage,
        limit: currentLimit,
        totalPages: Math.ceil(total / limitNum),
        hasMore: currentPage < Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * PATCH /admin/blockchain/reconciliation/:alertId/resolve
   *
   * Mark a reconciliation alert as resolved.
   * Requires admin authentication.
   *
   * @param alertId - The alert ID to resolve
   * @param resolvedNote - Notes on how the issue was resolved
   */
  @Patch('reconciliation/:alertId/resolve')
  @ApiOperation({
    summary: 'Resolve reconciliation alert',
    description: 'Mark an alert as resolved with optional notes on the resolution. Admin only.',
  })
  async resolveAlert(
    @Param('alertId') alertId: string,
    @Query('resolvedNote') resolvedNote: string = '',
  ): Promise<{ message: string }> {
    await this.contractEventListenerService.resolveAlert(alertId, resolvedNote);
    return { message: `Alert ${alertId} marked as resolved` };
  }

  @Get('account/:address')
  @ApiOperation({ summary: 'Get full Stellar account details including trust lines and balances' })
  async getAccountDetails(@Param('address') address: string) {
    return this.stellarAssetService.getAccountDetails(address);
  }
}
