import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SlippageConfig } from './entities/slippage-config.entity';

export const SLIPPAGE_EXCEEDED_EVENT = 'slippage.exceeded';

export interface SlippageExceededPayload {
  expectedRate: string;
  actualRate: string;
  maxSlippageBps: number;
  actualSlippageBps: number;
}

/** Default max slippage: 100 bps = 1 % */
const DEFAULT_MAX_SLIPPAGE_BPS = 100;
const SINGLETON_KEY = 'global';

@Injectable()
export class SlippageService implements OnModuleInit {
  private readonly logger = new Logger(SlippageService.name);

  constructor(
    @InjectRepository(SlippageConfig)
    private readonly configRepo: Repository<SlippageConfig>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    // Seed the singleton row if it doesn't exist yet
    const existing = await this.configRepo.findOne({ where: { key: SINGLETON_KEY } });
    if (!existing) {
      await this.configRepo.save(
        this.configRepo.create({ key: SINGLETON_KEY, maxSlippageBps: DEFAULT_MAX_SLIPPAGE_BPS }),
      );
      this.logger.log(`Seeded default max_slippage_bps = ${DEFAULT_MAX_SLIPPAGE_BPS}`);
    }
  }

  /**
   * Returns the current max slippage tolerance in basis points.
   */
  async getMaxSlippageBps(): Promise<number> {
    const row = await this.configRepo.findOne({ where: { key: SINGLETON_KEY } });
    return row?.maxSlippageBps ?? DEFAULT_MAX_SLIPPAGE_BPS;
  }

  /**
   * Admin function — update the max slippage tolerance.
   * @param bps  New threshold in basis points (0–10000).
   */
  async setMaxSlippage(bps: number): Promise<void> {
    if (bps < 0 || bps > 10_000) {
      throw new BadRequestException('maxSlippageBps must be between 0 and 10000');
    }

    const row = await this.configRepo.findOne({ where: { key: SINGLETON_KEY } });
    if (!row) {
      await this.configRepo.save(
        this.configRepo.create({ key: SINGLETON_KEY, maxSlippageBps: bps }),
      );
    } else {
      row.maxSlippageBps = bps;
      await this.configRepo.save(row);
    }

    this.logger.log(`max_slippage_bps updated to ${bps}`);
  }

  /**
   * Check whether the actual swap rate deviates beyond the allowed threshold.
   *
   * Both rates are expressed as arbitrary-precision decimal strings
   * (e.g. "1.0523") so we avoid floating-point loss.
   *
   * Slippage bps = abs(expected - actual) / expected * 10_000
   *
   * @throws ForbiddenException when slippage exceeds the threshold.
   */
  async checkSlippage(expectedRate: string, actualRate: string): Promise<void> {
    const expected = parseFloat(expectedRate);
    const actual = parseFloat(actualRate);

    if (isNaN(expected) || expected === 0) {
      throw new BadRequestException('expectedRate must be a non-zero number');
    }
    if (isNaN(actual)) {
      throw new BadRequestException('actualRate must be a valid number');
    }

    const maxBps = await this.getMaxSlippageBps();
    const actualBps = Math.round((Math.abs(expected - actual) / expected) * 10_000);

    if (actualBps > maxBps) {
      const payload: SlippageExceededPayload = {
        expectedRate,
        actualRate,
        maxSlippageBps: maxBps,
        actualSlippageBps: actualBps,
      };

      this.eventEmitter.emit(SLIPPAGE_EXCEEDED_EVENT, payload);
      this.logger.warn(
        `SlippageExceeded: expected=${expectedRate} actual=${actualRate} ` +
          `slippage=${actualBps}bps max=${maxBps}bps`,
      );

      throw new ForbiddenException(
        `Swap rejected: slippage ${actualBps} bps exceeds max ${maxBps} bps`,
      );
    }
  }
}
