import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan, DataSource } from 'typeorm';
import { SettlementRule, SettlementCondition } from '../database/entities/settlement-rule.entity';
import { Settlement } from '../settlement/entities/settlement.entity';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction, ActorType } from '../database/entities/audit-log.enums';
import { CreateSettlementRuleDto, UpdateSettlementRuleDto, TestSettlementRuleDto } from './dto/settlement-rule.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SettlementConfigService {
  private readonly logger = new Logger(SettlementConfigService.name);

  constructor(
    @InjectRepository(SettlementRule)
    private readonly ruleRepository: Repository<SettlementRule>,
    @InjectRepository(Settlement)
    private readonly settlementRepository: Repository<Settlement>,
    private readonly auditLogService: AuditLogService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll() {
    const rules = await this.ruleRepository.find({
      order: { priority: 'ASC' },
    });

    // Fetch match counts for last 30 days for each rule
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rulesWithStats = await Promise.all(
      rules.map(async (rule) => {
        const matchCount = await this.settlementRepository.count({
          where: {
            appliedRuleId: rule.id,
            createdAt: MoreThan(thirtyDaysAgo),
          },
        });
        return { ...rule, matchCount };
      }),
    );

    return rulesWithStats;
  }

  async findOne(id: string) {
    const rule = await this.ruleRepository.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Settlement rule with ID ${id} not found`);
    }
    return rule;
  }

  async create(dto: CreateSettlementRuleDto, actorId: string) {
    const rule = this.ruleRepository.create({
      ...dto,
      createdById: actorId,
    });

    const saved = await this.ruleRepository.save(rule);

    await this.auditLogService.log({
      entityType: 'SettlementRule',
      entityId: saved.id,
      action: AuditAction.CREATE,
      actorId,
      actorType: ActorType.ADMIN,
      afterState: saved as any,
    });

    return saved;
  }

  async update(id: string, dto: UpdateSettlementRuleDto, actorId: string) {
    const rule = await this.findOne(id);
    const beforeState = { ...rule };

    Object.assign(rule, dto);
    const saved = await this.ruleRepository.save(rule);

    await this.auditLogService.log({
      entityType: 'SettlementRule',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      actorId,
      actorType: ActorType.ADMIN,
      beforeState: beforeState as any,
      afterState: saved as any,
    });

    return saved;
  }

  async remove(id: string, actorId: string) {
    const rule = await this.findOne(id);

    // Cannot delete if rule matched settlements in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentMatches = await this.settlementRepository.count({
      where: {
        appliedRuleId: id,
        createdAt: MoreThan(sevenDaysAgo),
      },
    });

    if (recentMatches > 0) {
      throw new BadRequestException(
        'Cannot delete rule that matched settlements in the last 7 days. Please disable it instead.',
      );
    }

    await this.ruleRepository.softRemove(rule);

    await this.auditLogService.log({
      entityType: 'SettlementRule',
      entityId: id,
      action: AuditAction.DELETE,
      actorId,
      actorType: ActorType.ADMIN,
      beforeState: rule as any,
    });
  }

  async reorder(orderedIds: string[], actorId: string) {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(SettlementRule);
      for (let i = 0; i < orderedIds.length; i++) {
        await repo.update(orderedIds[i], { priority: i + 1 });
      }
    });

    await this.auditLogService.log({
      entityType: 'SettlementRule',
      entityId: 'bulk',
      action: AuditAction.UPDATE,
      actorId,
      actorType: ActorType.ADMIN,
      metadata: { orderedIds },
    });
  }

  async test(dto: TestSettlementRuleDto) {
    const rules = await this.ruleRepository.find({
      where: { isEnabled: true },
      order: { priority: 'ASC' },
    });

    const evaluationTrace: any[] = [];
    let matchedRule: SettlementRule | null = null;

    for (const rule of rules) {
      if (rule.expiresAt && new Date(rule.expiresAt) < new Date()) {
        evaluationTrace.push({
          ruleId: rule.id,
          name: rule.name,
          matched: false,
          reason: 'Rule expired',
        });
        continue;
      }

      const matchResult = this.evaluateRule(rule, dto);
      evaluationTrace.push({
        ruleId: rule.id,
        name: rule.name,
        matched: matchResult.matched,
        reason: matchResult.reason,
      });

      if (matchResult.matched && !matchedRule) {
        matchedRule = rule;
      }
    }

    return {
      matchedRule: matchedRule
        ? { id: matchedRule.id, name: matchedRule.name, priority: matchedRule.priority }
        : null,
      action: matchedRule ? matchedRule.actions : null,
      evaluationTrace,
    };
  }

  private evaluateRule(rule: SettlementRule, data: TestSettlementRuleDto): { matched: boolean; reason?: string } {
    for (const condition of rule.conditions) {
      const value = this.getFieldValue(condition.field, data);
      const isMatched = this.compare(value, condition.operator, condition.value);

      if (!isMatched) {
        return {
          matched: false,
          reason: `${condition.field} ${value} ${condition.operator} ${condition.value} failed`,
        };
      }
    }
    return { matched: true };
  }

  private getFieldValue(field: string, data: TestSettlementRuleDto): any {
    const [obj, key] = field.split('.');
    if (obj === 'merchant') {
      return (data.sampleMerchant as any)[key];
    }
    if (obj === 'transaction') {
      return (data.sampleTransaction as any)[key];
    }
    return undefined;
  }

  private compare(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'eq': return actual === expected;
      case 'ne': return actual !== expected;
      case 'gt': return actual > expected;
      case 'lt': return actual < expected;
      case 'gte': return actual >= expected;
      case 'lte': return actual <= expected;
      case 'in': return Array.isArray(expected) && expected.includes(actual);
      case 'not_in': return Array.isArray(expected) && !expected.includes(actual);
      default: return false;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async disableExpiredRules() {
    this.logger.log('Disabling expired settlement rules...');
    const result = await this.ruleRepository.update(
      {
        isEnabled: true,
        expiresAt: LessThan(new Date()),
      },
      { isEnabled: false },
    );
    this.logger.log(`Disabled ${result.affected} expired settlement rules.`);
  }
}
