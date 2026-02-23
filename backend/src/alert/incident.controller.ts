import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { AdminJwtGuard } from 'src/auth/guards/admin-jwt.guard';
import { PermissionGuard } from 'src/auth/guards/permission.guard';
import {
  ListIncidentsQueryDto,
  CreateIncidentDto,
  UpdateIncidentDto,
  AddTimelineEntryDto,
  ResolveIncidentDto,
} from './dto/incident.dto';
import { AlertEventService } from './services/alert-event.service';
import { IncidentService } from './services/incident.service';

@Controller('api/v1/incidents')
@UseGuards(AdminJwtGuard, PermissionGuard)
export class IncidentController {
  constructor(
    private readonly incidentService: IncidentService,
    private readonly alertEventService: AlertEventService,
  ) {}

  @Get()
  @Permissions('analytics:read')
  listIncidents(@Query() query: ListIncidentsQueryDto) {
    return this.incidentService.listIncidents(query);
  }

  @Post()
  @Permissions('analytics:read')
  create(@Body() dto: CreateIncidentDto, @CurrentUser() user: any) {
    return this.incidentService.create(dto, user.id);
  }

  @Get('metrics')
  @Permissions('analytics:read')
  getMetrics() {
    return this.incidentService.getMetrics();
  }

  @Get(':id')
  @Permissions('analytics:read')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.incidentService.findById(id);
  }

  @Patch(':id')
  @Permissions('analytics:read')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser() user: any,
  ) {
    return this.incidentService.update(id, dto, user.id);
  }

  @Post(':id/timeline')
  @Permissions('analytics:read')
  addTimeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTimelineEntryDto,
    @CurrentUser() user: any,
  ) {
    return this.incidentService.addTimelineEntry(id, user.id, dto);
  }

  @Post(':id/resolve')
  @Permissions('analytics:read')
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveIncidentDto,
    @CurrentUser() user: any,
  ) {
    return this.incidentService.resolve(
      id,
      user.id,
      dto,
      this.alertEventService,
    );
  }
}
