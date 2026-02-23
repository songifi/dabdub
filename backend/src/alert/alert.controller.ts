import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AdminJwtGuard } from 'src/auth/guards/admin-jwt.guard';
import { PermissionGuard } from 'src/auth/guards/permission.guard';
import {
  CreateAlertRuleDto,
  UpdateAlertRuleDto,
  ListAlertEventsQueryDto,
  AcknowledgeAlertDto,
  ResolveAlertDto,
} from './dto/alert.rule.dto';
import { AlertEventService } from './services/alert-event.service';
import { AlertRuleService } from './services/alert-rule.service';
import { SuperAdminGuard } from 'src/auth/guards/super-admin.guard';
import { Permissions } from 'src/auth/decorators/permissions.decorator';

@Controller('api/v1/alerts')
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AlertController {
  constructor(
    private readonly ruleService: AlertRuleService,
    private readonly eventService: AlertEventService,
  ) {}

  // ── Alert Rules ──────────────────────────────────────────────────────────────

  @Get('rules')
  @Permissions('config:read')
  listRules() {
    return this.ruleService.listRules();
  }

  @Post('rules')
  @Permissions('config:write')
  createRule(@Body() dto: CreateAlertRuleDto) {
    return this.ruleService.createRule(dto);
  }

  @Patch('rules/:id')
  @Permissions('config:write')
  updateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    return this.ruleService.updateRule(id, dto);
  }

  /** SUPER_ADMIN only — disables (soft deletes) a rule */
  @Delete('rules/:id')
  @UseGuards(SuperAdminGuard)
  disableRule(@Param('id', ParseUUIDPipe) id: string) {
    return this.ruleService.disableRule(id);
  }

  /**
   * Dry-run: evaluate a rule against current metrics without creating an event.
   * Returns { wouldFire, currentValue, threshold, reason }
   */
  @Post('rules/:id/test')
  @Permissions('config:read')
  testRule(@Param('id', ParseUUIDPipe) id: string) {
    return this.ruleService.testRule(id);
  }

  // ── Alert Events ─────────────────────────────────────────────────────────────

  @Get('events')
  @Permissions('analytics:read')
  listEvents(@Query() query: ListAlertEventsQueryDto) {
    return this.eventService.listEvents(query);
  }

  @Get('events/active')
  @Permissions('analytics:read')
  listActiveEvents() {
    return this.eventService.listActiveEvents();
  }

  @Post('events/:id/acknowledge')
  @Permissions('analytics:read')
  acknowledgeEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcknowledgeAlertDto,
    @CurrentUser() user: any,
  ) {
    return this.eventService.acknowledge(id, user.id, dto);
  }

  @Post('events/:id/resolve')
  @Permissions('analytics:read')
  resolveEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveAlertDto,
    @CurrentUser() user: any,
  ) {
    return this.eventService.resolve(id, user.id, dto);
  }

  @Post('events/:id/escalate-to-incident')
  @Permissions('analytics:read')
  escalateToIncident(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.eventService.escalateToIncident(id, user.id);
  }
}
