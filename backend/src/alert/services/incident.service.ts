import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, FindOptionsWhere } from 'typeorm';
import { Incident } from '../entities/incident.entity';
import { IncidentTimelineEntry } from '../entities/incident-timeline-entry.entity';
import {
  CreateIncidentDto,
  UpdateIncidentDto,
  AddTimelineEntryDto,
  ResolveIncidentDto,
  ListIncidentsQueryDto,
} from '../dto/incident.dto';
import { AlertEvent } from '../entities/alert-event.entity';
import { AlertRule } from '../entities/alert-rule.entity';
import { AlertSeverity } from '../enums/alert.enums';
import {
  IncidentStatus,
  TimelineEntryType,
  IncidentSeverity,
} from '../enums/incident.enums';

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name);

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepo: Repository<Incident>,
    @InjectRepository(IncidentTimelineEntry)
    private readonly timelineRepo: Repository<IncidentTimelineEntry>,
  ) {}

  // ── List ─────────────────────────────────────────────────────────────────────

  async listIncidents(query: ListIncidentsQueryDto): Promise<Incident[]> {
    const where: FindOptionsWhere<Incident> = {};
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.assignedToId) where.assignedToId = query.assignedToId;

    const qb = this.incidentRepo.createQueryBuilder('i').where(where);

    if (query.createdAfter) {
      qb.andWhere('i.createdAt >= :after', {
        after: new Date(query.createdAfter),
      });
    }

    return qb.orderBy('i.createdAt', 'DESC').getMany();
  }

  // ── Create manually ───────────────────────────────────────────────────────────

  async create(dto: CreateIncidentDto, adminId: string): Promise<Incident> {
    const now = new Date();
    const incident = this.incidentRepo.create({
      title: dto.title,
      description: dto.description,
      severity: dto.severity,
      status: IncidentStatus.OPEN,
      assignedToId: dto.assignedToId ?? null,
      createdById: adminId,
      isAutoCreated: false,
      affectedServices: dto.affectedServices,
      alertEventIds: [],
      detectedAt: now,
    });
    const saved = await this.incidentRepo.save(incident);
    await this.addTimeline(
      saved.id,
      adminId,
      TimelineEntryType.STATUS_CHANGE,
      'Incident created manually',
    );
    return saved;
  }

  // ── Create from alert event (called by AlertRuleService on autoCreateIncident) ─

  async createFromAlertEvent(
    event: AlertEvent,
    rule: AlertRule,
  ): Promise<Incident> {
    const severity = this.mapAlertSeverityToIncident(rule.severity);
    const now = new Date();

    const incident = this.incidentRepo.create({
      title: `[AUTO] ${rule.name} threshold breached`,
      description: `Alert rule "${rule.name}" fired. Metric ${rule.metric} = ${event.triggerValue} (threshold: ${event.thresholdValue})`,
      severity,
      status: IncidentStatus.OPEN,
      createdById: null,
      isAutoCreated: true,
      affectedServices: [],
      alertEventIds: [event.id],
      detectedAt: now,
    });

    const saved = await this.incidentRepo.save(incident);

    await this.addTimeline(
      saved.id,
      'system',
      TimelineEntryType.STATUS_CHANGE,
      `Incident auto-created from alert event ${event.id} (rule: ${rule.name})`,
      { alertEventId: event.id, triggerValue: event.triggerValue },
    );

    this.logger.warn(
      `Auto-created incident ${saved.id} from alert event ${event.id}`,
    );

    return saved;
  }

  // ── Get detail with timeline ────────────────────────────────────────────────

  async findById(
    id: string,
  ): Promise<{ incident: Incident; timeline: IncidentTimelineEntry[] }> {
    const incident = await this.findOrFail(id);
    const timeline = await this.timelineRepo.find({
      where: { incidentId: id },
      order: { createdAt: 'ASC' },
    });
    return { incident, timeline };
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateIncidentDto,
    adminId: string,
  ): Promise<Incident> {
    const incident = await this.findOrFail(id);
    const prevStatus = incident.status;

    if (dto.status) incident.status = dto.status;
    if (dto.assignedToId !== undefined)
      incident.assignedToId = dto.assignedToId ?? null;
    if (dto.severity) incident.severity = dto.severity;

    // Track acknowledge timestamp
    if (
      dto.status === IncidentStatus.ACKNOWLEDGED &&
      !incident.acknowledgedAt
    ) {
      incident.acknowledgedAt = new Date();
      if (incident.detectedAt) {
        incident.timeToAcknowledgeMinutes = Math.round(
          (incident.acknowledgedAt.getTime() - incident.detectedAt.getTime()) /
            60_000,
        );
      }
    }

    // Track mitigated timestamp
    if (dto.status === IncidentStatus.MITIGATED && !incident.mitigatedAt) {
      incident.mitigatedAt = new Date();
    }

    const saved = await this.incidentRepo.save(incident);

    if (dto.status && dto.status !== prevStatus) {
      await this.addTimeline(
        id,
        adminId,
        TimelineEntryType.STATUS_CHANGE,
        `Status changed from ${prevStatus} → ${dto.status}`,
        { previousStatus: prevStatus, newStatus: dto.status },
      );
    }

    return saved;
  }

  // ── Add timeline entry ──────────────────────────────────────────────────────

  async addTimelineEntry(
    incidentId: string,
    adminId: string,
    dto: AddTimelineEntryDto,
  ): Promise<IncidentTimelineEntry> {
    await this.findOrFail(incidentId);
    return this.addTimeline(incidentId, adminId, dto.type, dto.content);
  }

  // ── Resolve with MTTR ───────────────────────────────────────────────────────

  async resolve(
    id: string,
    adminId: string,
    dto: ResolveIncidentDto,
    alertEventService: { autoResolveByIds(ids: string[]): Promise<void> },
  ): Promise<Incident> {
    const incident = await this.findOrFail(id);

    if (
      incident.status === IncidentStatus.RESOLVED ||
      incident.status === IncidentStatus.CLOSED
    ) {
      throw new BadRequestException('Incident is already resolved');
    }

    const now = new Date();
    incident.status = IncidentStatus.RESOLVED;
    incident.resolvedAt = now;

    // MTTR: detectedAt → resolvedAt
    if (incident.detectedAt) {
      incident.timeToResolutionMinutes = Math.round(
        (now.getTime() - incident.detectedAt.getTime()) / 60_000,
      );
    }

    // Acknowledge time if not set yet
    if (!incident.acknowledgedAt) {
      incident.acknowledgedAt = now;
      incident.timeToAcknowledgeMinutes = incident.timeToResolutionMinutes;
    }

    const saved = await this.incidentRepo.save(incident);

    // Add resolution timeline entry
    const content = [
      `Incident resolved by admin ${adminId}.`,
      `Resolution note: ${dto.resolutionNote}`,
      dto.rootCause ? `Root cause: ${dto.rootCause}` : '',
      dto.preventionActions
        ? `Prevention actions: ${dto.preventionActions}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    await this.addTimeline(id, adminId, TimelineEntryType.RESOLUTION, content, {
      rootCause: dto.rootCause,
      preventionActions: dto.preventionActions,
    });

    // Auto-resolve all linked active alert events
    if (incident.alertEventIds.length > 0) {
      await alertEventService.autoResolveByIds(incident.alertEventIds);
    }

    this.logger.log(
      `Incident ${id} resolved. MTTR: ${incident.timeToResolutionMinutes} minutes`,
    );

    return saved;
  }

  // ── Metrics ─────────────────────────────────────────────────────────────────

  async getMetrics(): Promise<{
    last30d: {
      total: number;
      byPriority: Record<string, number>;
      averageMttrMinutes: number;
      averageMttaMinutes: number;
      resolvedCount: number;
      openCount: number;
    };
  }> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const incidents = await this.incidentRepo.find({
      where: { createdAt: MoreThan(since) },
    });

    const total = incidents.length;
    const byPriority: Record<string, number> = {
      P1: 0,
      P2: 0,
      P3: 0,
      P4: 0,
    };

    let totalMttr = 0;
    let mttrCount = 0;
    let totalMtta = 0;
    let mttaCount = 0;
    let resolvedCount = 0;
    let openCount = 0;

    for (const inc of incidents) {
      // Map severity to priority label
      const priority =
        {
          [IncidentSeverity.P1_CRITICAL]: 'P1',
          [IncidentSeverity.P2_HIGH]: 'P2',
          [IncidentSeverity.P3_MEDIUM]: 'P3',
          [IncidentSeverity.P4_LOW]: 'P4',
        }[inc.severity] ?? 'P4';

      byPriority[priority] = (byPriority[priority] ?? 0) + 1;

      if (inc.timeToResolutionMinutes != null) {
        totalMttr += inc.timeToResolutionMinutes;
        mttrCount++;
      }
      if (inc.timeToAcknowledgeMinutes != null) {
        totalMtta += inc.timeToAcknowledgeMinutes;
        mttaCount++;
      }
      if (
        inc.status === IncidentStatus.RESOLVED ||
        inc.status === IncidentStatus.CLOSED
      ) {
        resolvedCount++;
      } else {
        openCount++;
      }
    }

    return {
      last30d: {
        total,
        byPriority,
        averageMttrMinutes:
          mttrCount > 0 ? Math.round(totalMttr / mttrCount) : 0,
        averageMttaMinutes:
          mttaCount > 0 ? Math.round(totalMtta / mttaCount) : 0,
        resolvedCount,
        openCount,
      },
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async findOrFail(id: string): Promise<Incident> {
    const inc = await this.incidentRepo.findOne({ where: { id } });
    if (!inc) throw new NotFoundException(`Incident ${id} not found`);
    return inc;
  }

  private async addTimeline(
    incidentId: string,
    adminId: string,
    type: TimelineEntryType,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<IncidentTimelineEntry> {
    const entry = this.timelineRepo.create({
      incidentId,
      adminId,
      type,
      content,
      metadata: metadata ?? null,
    });
    return this.timelineRepo.save(entry);
  }

  private mapAlertSeverityToIncident(
    severity: AlertSeverity,
  ): IncidentSeverity {
    const map: Record<AlertSeverity, IncidentSeverity> = {
      [AlertSeverity.CRITICAL]: IncidentSeverity.P1_CRITICAL,
      [AlertSeverity.HIGH]: IncidentSeverity.P2_HIGH,
      [AlertSeverity.WARNING]: IncidentSeverity.P3_MEDIUM,
      [AlertSeverity.INFO]: IncidentSeverity.P4_LOW,
    };
    return map[severity] ?? IncidentSeverity.P4_LOW;
  }
}
