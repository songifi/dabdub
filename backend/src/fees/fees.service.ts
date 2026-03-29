import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FeeConfig,
  FeeRateType,
  FeeType,
} from '../fee-config/entities/fee-config.entity';
import { FeeRecord } from './entities/fee-record.entity';
import { NoFeeConfigException } from './exceptions/no-fee-config.exception';

const DECIMAL_SCALE = 8n;
const DECIMAL_FACTOR = 10n ** DECIMAL_SCALE;

type DecimalParts = { value: bigint; scale: bigint };

export interface FeeComputationResult {
  gross: string;
  fee: string;
  net: string;
  feeConfigId: string;
}

export interface RecordFeeDto {
  userId: string;
  txType: FeeType;
  txId: string;
  grossAmount: string;
  feeAmount: string;
  netAmount: string;
  feeConfigId: string;
}

@Injectable()
export class FeesService {
  constructor(
    @InjectRepository(FeeConfig)
    private readonly feeConfigRepo: Repository<FeeConfig>,
    @InjectRepository(FeeRecord)
    private readonly feeRecordRepo: Repository<FeeRecord>,
  ) {}

  async computeFee(
    type: FeeType,
    amount: string,
  ): Promise<FeeComputationResult> {
    const config = await this.feeConfigRepo
      .createQueryBuilder('fc')
      .where('fc.fee_type = :type', { type })
      .andWhere('fc.is_active = :isActive', { isActive: true })
      .andWhere('fc.effective_from <= :now', { now: new Date() })
      .orderBy('fc.effective_from', 'DESC')
      .addOrderBy('fc.createdAt', 'DESC')
      .getOne();

    if (!config) {
      throw new NoFeeConfigException(type);
    }

    const grossAmount = this.normalizeDecimal(amount);
    const feeAmount =
      config.rateType === FeeRateType.PERCENT
        ? this.percentOf(grossAmount, config.value)
        : this.normalizeDecimal(config.value);

    const netAmount = this.subtract(grossAmount, feeAmount);

    return {
      gross: grossAmount,
      fee: feeAmount,
      net: netAmount,
      feeConfigId: config.id,
    };
  }

  async recordFee(dto: RecordFeeDto): Promise<FeeRecord> {
    const entity = this.feeRecordRepo.create({
      userId: dto.userId,
      txType: dto.txType,
      txId: dto.txId,
      grossAmount: this.normalizeDecimal(dto.grossAmount),
      feeAmount: this.normalizeDecimal(dto.feeAmount),
      netAmount: this.normalizeDecimal(dto.netAmount),
      feeConfigId: dto.feeConfigId,
    });

    return this.feeRecordRepo.save(entity);
  }

  async createConfig(input: {
    type: FeeType;
    rateType: FeeRateType;
    value: string;
    effectiveFrom: Date;
    isActive: boolean;
    createdBy: string;
  }): Promise<FeeConfig> {
    const config = this.feeConfigRepo.create({
      feeType: input.type,
      rateType: input.rateType,
      value: this.normalizeDecimal(input.value),
      effectiveFrom: input.effectiveFrom,
      isActive: input.isActive,
      createdBy: input.createdBy,
    });

    return this.feeConfigRepo.save(config);
  }

  async deactivateConfig(id: string): Promise<FeeConfig> {
    const config = await this.feeConfigRepo.findOneOrFail({ where: { id } });
    config.isActive = false;
    return this.feeConfigRepo.save(config);
  }

  async listConfigs(): Promise<FeeConfig[]> {
    return this.feeConfigRepo.find({
      order: { effectiveFrom: 'DESC', createdAt: 'DESC' },
    });
  }

  async listRecords(query: {
    txType?: FeeType;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: FeeRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.feeRecordRepo
      .createQueryBuilder('fr')
      .orderBy('fr.created_at', 'DESC');

    if (query.txType) {
      qb.andWhere('fr.tx_type = :txType', { txType: query.txType });
    }

    if (query.userId) {
      qb.andWhere('fr.user_id = :userId', { userId: query.userId });
    }

    if (query.dateFrom) {
      qb.andWhere('fr.created_at >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }

    if (query.dateTo) {
      qb.andWhere('fr.created_at <= :dateTo', {
        dateTo: new Date(query.dateTo),
      });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async getSummary(): Promise<{
    today: Record<string, string>;
    month: Record<string, string>;
  }> {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayRows, monthRows] = await Promise.all([
      this.sumByTypeSince(startOfToday),
      this.sumByTypeSince(startOfMonth),
    ]);

    return {
      today: this.rowsToSummary(todayRows),
      month: this.rowsToSummary(monthRows),
    };
  }

  private async sumByTypeSince(
    since: Date,
  ): Promise<Array<{ txType: FeeType; total: string }>> {
    const rows = await this.feeRecordRepo
      .createQueryBuilder('fr')
      .select('fr.tx_type', 'txType')
      .addSelect('COALESCE(SUM(fr.fee_amount), 0)', 'total')
      .where('fr.created_at >= :since', { since })
      .groupBy('fr.tx_type')
      .getRawMany<{ txType: FeeType; total: string }>();

    return rows;
  }

  private rowsToSummary(
    rows: Array<{ txType: FeeType; total: string }>,
  ): Record<string, string> {
    const summary: Record<string, string> = {
      [FeeType.TRANSFER]: this.normalizeDecimal('0'),
      [FeeType.WITHDRAWAL]: this.normalizeDecimal('0'),
      [FeeType.PAYLINK]: this.normalizeDecimal('0'),
      [FeeType.STAKE]: this.normalizeDecimal('0'),
    };

    for (const row of rows) {
      summary[row.txType] = this.normalizeDecimal(row.total);
    }

    return summary;
  }

  private percentOf(amount: string, percentValue: string): string {
    const amountParts = this.parseDecimal(amount);
    const percentParts = this.parseDecimal(percentValue);
    const amountInt = this.toScaledInt(amountParts, DECIMAL_SCALE);
    const percentInt = this.toScaledInt(percentParts, DECIMAL_SCALE);

    const denominator = 100n * DECIMAL_FACTOR * DECIMAL_FACTOR;
    const numerator = amountInt * percentInt * DECIMAL_FACTOR;
    const result = numerator / denominator;

    return this.fromScaledInt(result, DECIMAL_SCALE);
  }

  private subtract(left: string, right: string): string {
    const leftInt = this.toScaledInt(this.parseDecimal(left), DECIMAL_SCALE);
    const rightInt = this.toScaledInt(this.parseDecimal(right), DECIMAL_SCALE);
    return this.fromScaledInt(leftInt - rightInt, DECIMAL_SCALE);
  }

  private normalizeDecimal(value: string): string {
    const parts = this.parseDecimal(value);
    const scaled = this.toScaledInt(parts, DECIMAL_SCALE);
    return this.fromScaledInt(scaled, DECIMAL_SCALE);
  }

  private parseDecimal(input: string): DecimalParts {
    const raw = String(input).trim();
    if (!/^[-+]?\d+(\.\d+)?$/.test(raw)) {
      throw new Error(`Invalid decimal value: ${input}`);
    }

    const isNegative = raw.startsWith('-');
    const normalized = raw.replace(/^[-+]/, '');
    const [whole, fraction = ''] = normalized.split('.');
    const scale = BigInt(fraction.length);
    const digits = BigInt(`${whole}${fraction}`);
    const signed = isNegative ? -digits : digits;

    return { value: signed, scale };
  }

  private toScaledInt(parts: DecimalParts, targetScale: bigint): bigint {
    if (parts.scale === targetScale) {
      return parts.value;
    }

    if (parts.scale < targetScale) {
      return parts.value * 10n ** (targetScale - parts.scale);
    }

    return parts.value / 10n ** (parts.scale - targetScale);
  }

  private fromScaledInt(value: bigint, scale: bigint): string {
    const negative = value < 0n;
    const absolute = negative ? -value : value;
    const base = 10n ** scale;
    const whole = absolute / base;
    const fraction = absolute % base;
    const fractionText = fraction.toString().padStart(Number(scale), '0');
    return `${negative ? '-' : ''}${whole.toString()}.${fractionText}`;
  }
}
