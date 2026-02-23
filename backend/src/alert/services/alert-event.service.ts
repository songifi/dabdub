import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan, FindOptionsWhere } from 'typeorm';
import { AlertEvent } from '../entities/alert-event.entity';
import { AlertRule } from '../entities/alert-rule.entity';
import {
  ListAlertEventsQueryDto,
  AcknowledgeAlertDto,
  ResolveAlertDto,
} from '../dto/alert.rule.dto';
import { AlertEventStatus } from '../enums/alert.enums';
import { IncidentService } from './incident.service';

@Injectable()
export class AlertEventService {
  private readonly logger = new Logger(AlertEventService.name);

  constructor(
    @InjectRepository(AlertEvent)
    private readonly eventRepo: Repository<AlertEvent>,
    @InjectRepository(AlertRule)
    private readonly ruleRepo: Repository<AlertRule>,
    private readonly incidentService: IncidentService,
  ) {}

  async listEvents(query: ListAlertEventsQueryDto): Promise<{
    data: AlertEvent[];
    meta: { total: number; page: number; limit: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: FindOptionsWhere<AlertEvent> = {};

    if (query.status) where.status = query.status as AlertEventStatus;
    if (query.ruleId) where.ruleId = query.ruleId;

    const qb = this.eventRepo
      .createQueryBuilder('ae')
      .leftJoinAndSelect('ae.rule', 'rule')
      .where(where);

    if (query.severity) {
      qb.andWhere('rule.severity = :severity', { severity: query.severity });
    }
    if (query.createdAfter) {
      qb.andWhere('ae.createdAt >= :after', {
        after: new Date(query.createdAfter),
      });
    }
    if (query.createdBefore) {
      qb.andWhere('ae.createdAt <= :before', {
        before: new Date(query.createdBefore),
      });
    }

    qb.orderBy('ae.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { total, page, limit } };
  }

  async listActiveEvents(): Promise<AlertEvent[]> {
    return this.eventRepo.find({
      where: { status: AlertEventStatus.ACTIVE },
      relations: ['rule'],
      order: { createdAt: 'DESC' },
    });
  }

  async acknowledge(
    id: string,
    adminId: string,
    dto: AcknowledgeAlertDto,
  ): Promise<AlertEvent> {
    const event = await this.findOrFail(id);

    if (event.status !== AlertEventStatus.ACTIVE) {
      throw new BadRequestException(
        `Alert event is already ${event.status} and cannot be acknowledged`,
      );
    }

    event.status = AlertEventStatus.ACKNOWLEDGED;
    event.acknowledgedById = adminId;
    event.acknowledgedAt = new Date();
    event.acknowledgmentNote = dto.note;

    return this.eventRepo.save(event);
  }

  async resolve(
    id: string,
    adminId: string,
    dto: ResolveAlertDto,
  ): Promise<AlertEvent> {
    const event = await this.findOrFail(id);

    if (
      event.status === AlertEventStatus.RESOLVED ||
      event.status === AlertEventStatus.AUTO_RESOLVED
    ) {
      throw new BadRequestException('Alert event is already resolved');
    }

    event.status = AlertEventStatus.RESOLVED;
    event.resolvedById = adminId;
    event.resolvedAt = new Date();
    event.resolutionNote = dto.resolutionNote;

    return this.eventRepo.save(event);
  }

  async escalateToIncident(
    id: string,
    adminId: string,
  ): Promise<{
    alertEvent: AlertEvent;
    incidentId: string;
  }> {
    const event = await this.findOrFail(id);

    if (event.incidentId) {
      throw new BadRequestException(
        `Alert event is already linked to incident ${event.incidentId}`,
      );
    }

    const rule = await this.ruleRepo.findOne({ where: { id: event.ruleId } });

    const incident = await this.incidentService.createFromAlertEvent(
      event,
      rule!,
    );

    event.incidentId = incident.id;
    await this.eventRepo.save(event);

    return { alertEvent: event, incidentId: incident.id };
  }

  async autoResolveByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.eventRepo
      .createQueryBuilder()
      .update(AlertEvent)
      .set({
        status: AlertEventStatus.AUTO_RESOLVED,
        resolvedAt: new Date(),
      })
      .whereInIds(ids)
      .andWhere('status IN (:...statuses)', {
        statuses: [AlertEventStatus.ACTIVE, AlertEventStatus.ACKNOWLEDGED],
      })
      .execute();
  }

  private async findOrFail(id: string): Promise<AlertEvent> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['rule'],
    });
    if (!event) throw new NotFoundException(`Alert event ${id} not found`);
    return event;
  }
}
