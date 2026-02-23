import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertRule } from '../entities/alert-rule.entity';
import { AlertEvent } from '../entities/alert-event.entity';

import { CreateAlertRuleDto, UpdateAlertRuleDto } from '../dto/alert.rule.dto';
import {
  AlertSeverity,
  AlertEventStatus,
  AlertCondition,
} from '../enums/alert.enums';
import { MetricEvaluatorService } from './metric-evaluator.service';
import { IncidentService } from './incident.service';

@Injectable()
export class AlertRuleService {
  private readonly logger = new Logger(AlertRuleService.name);

  constructor(
    @InjectRepository(AlertRule)
    private readonly ruleRepo: Repository<AlertRule>,
    @InjectRepository(AlertEvent)
    private readonly eventRepo: Repository<AlertEvent>,
    private readonly metricEvaluator: MetricEvaluatorService,
    private readonly incidentService: IncidentService,
  ) {}

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async listRules(): Promise<AlertRule[]> {
    return this.ruleRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createRule(dto: CreateAlertRuleDto): Promise<AlertRule> {
    const rule = this.ruleRepo.create({
      ...dto,
      isEnabled: dto.isEnabled ?? true,
      notifyRoles: dto.notifyRoles ?? [],
      cooldownMinutes: dto.cooldownMinutes ?? 5,
      autoCreateIncident: dto.autoCreateIncident ?? false,
    });
    return this.ruleRepo.save(rule);
  }

  async updateRule(id: string, dto: UpdateAlertRuleDto): Promise<AlertRule> {
    const rule = await this.findRuleOrFail(id);
    Object.assign(rule, dto);
    return this.ruleRepo.save(rule);
  }

  async disableRule(id: string): Promise<AlertRule> {
    const rule = await this.findRuleOrFail(id);
    rule.isEnabled = false;
    return this.ruleRepo.save(rule);
  }

  // ── Test fire ────────────────────────────────────────────────────────────────

  async testRule(id: string): Promise<{
    wouldFire: boolean;
    currentValue: number;
    threshold: number;
    reason: string;
  }> {
    const rule = await this.findRuleOrFail(id);
    const currentValue = await this.metricEvaluator.evaluate(
      rule.metric,
      rule.conditions,
    );
    const wouldFire = this.checkCondition(currentValue, rule.conditions);
    const opLabel = { gt: '>', lt: '<', gte: '>=', lte: '<=' }[
      rule.conditions.operator
    ];

    return {
      wouldFire,
      currentValue,
      threshold: rule.conditions.threshold,
      reason: wouldFire
        ? `${rule.metric} is ${currentValue} ${opLabel} threshold ${rule.conditions.threshold} over the last ${rule.conditions.windowMinutes} minutes`
        : `${rule.metric} is ${currentValue} (threshold: ${rule.conditions.threshold}) — would NOT fire`,
    };
  }

  // ── Cron: every minute — WARNING, HIGH, CRITICAL rules ───────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async evaluateHighPriorityRules(): Promise<void> {
    const rules = await this.ruleRepo.find({
      where: { isEnabled: true },
    });
    const highPriority = rules.filter((r) => r.severity !== AlertSeverity.INFO);
    await this.evaluateBatch(highPriority);
  }

  // ── Cron: every 5 minutes — INFO rules ─────────────────────────────────────

  @Cron('0 */5 * * * *')
  async evaluateInfoRules(): Promise<void> {
    const rules = await this.ruleRepo.find({
      where: { isEnabled: true },
    });
    const infoRules = rules.filter((r) => r.severity === AlertSeverity.INFO);
    await this.evaluateBatch(infoRules);
  }

  // ── Core evaluation logic ────────────────────────────────────────────────────

  async evaluateBatch(rules: AlertRule[]): Promise<void> {
    for (const rule of rules) {
      try {
        await this.evaluateRule(rule);
      } catch (err: any) {
        this.logger.error(
          `Error evaluating rule ${rule.id} (${rule.name}): ${err.message}`,
        );
      }
    }
  }

  async evaluateRule(rule: AlertRule): Promise<AlertEvent | null> {
    const currentValue = await this.metricEvaluator.evaluate(
      rule.metric,
      rule.conditions,
    );
    const shouldFire = this.checkCondition(currentValue, rule.conditions);

    if (!shouldFire) return null;

    // Cooldown: check if this rule already fired within cooldownMinutes
    const cooldownCutoff = new Date(
      Date.now() - rule.cooldownMinutes * 60 * 1000,
    );
    const recentEvent = await this.eventRepo.findOne({
      where: {
        ruleId: rule.id,
        createdAt: MoreThan(cooldownCutoff),
      },
      order: { createdAt: 'DESC' },
    });

    if (recentEvent) {
      this.logger.debug(
        `Rule ${rule.id} is in cooldown — last fired at ${recentEvent.createdAt.toISOString()}`,
      );
      return null;
    }

    // Create the alert event
    const event = this.eventRepo.create({
      ruleId: rule.id,
      triggerValue: String(currentValue),
      thresholdValue: String(rule.conditions.threshold),
      status: AlertEventStatus.ACTIVE,
    });
    const saved = await this.eventRepo.save(event);

    this.logger.warn(
      `Alert fired: rule=${rule.name} metric=${rule.metric} value=${currentValue} threshold=${rule.conditions.threshold}`,
    );

    // Auto-create incident if configured
    if (rule.autoCreateIncident) {
      await this.incidentService.createFromAlertEvent(saved, rule);
    }

    return saved;
  }

  checkCondition(value: number, conditions: AlertCondition): boolean {
    const { operator, threshold } = conditions;
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      default:
        return false;
    }
  }

  private async findRuleOrFail(id: string): Promise<AlertRule> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException(`Alert rule ${id} not found`);
    return rule;
  }
}
