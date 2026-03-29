gimport {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import {
  ScheduledPayout,
  Frequency,
  Status,
} from './entities/scheduled-payout.entity';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { PinService } from '../pin/pin.service';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    @InjectRepository(ScheduledPayout)
    private readonly repo: Repository<ScheduledPayout>,
    @InjectQueue('payouts')
    private readonly queue: Queue,
    private readonly pinService: PinService,
  ) {}

  async create(userId: string, dto: CreatePayoutDto): Promise<ScheduledPayout> {
    await this.pinService.verifyPin(userId, dto.pin);

    if (dto.frequency === Frequency.WEEKLY && dto.dayOfWeek === undefined) {
      throw new BadRequestException('dayOfWeek is required for weekly frequency');
    }
    if (dto.frequency === Frequency.MONTHLY && dto.dayOfMonth === undefined) {
      throw new BadRequestException('dayOfMonth is required for monthly frequency');
    }

    const nextRunAt = this.computeNextRun(
      dto.frequency,
      dto.dayOfWeek,
      dto.dayOfMonth,
    );

    const payout = this.repo.create({
      userId,
      toUsername: dto.toUsername,
      amount: dto.amount,
      note: dto.note,
      frequency: dto.frequency,
      dayOfWeek: dto.dayOfWeek,
      dayOfMonth: dto.dayOfMonth,
      nextRunAt,
      status: Status.ACTIVE,
    });

    await this.repo.save(payout);

    await this.queue.add(
      'scheduledPayout',
      { payoutId: payout.id },
      {
        jobId: `payout:${payout.id}`,
        repeat: { cron: this.cronExpression(payout) },
        removeOnComplete: true,
      },
    );

    return payout;
  }

  async findAll(userId: string): Promise<ScheduledPayout[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async pause(userId: string, id: string): Promise<ScheduledPayout> {
    const payout = await this.repo.findOne({ where: { id, userId } });
    if (!payout) throw new NotFoundException('Scheduled payout not found');

    payout.status = Status.PAUSED;
    await this.repo.save(payout);

    // Bull repeatable jobs are removed by their repeat options
    const jobs = await this.queue.getRepeatableJobs();
    const job = jobs.find((j) => j.id === `payout:${payout.id}`);
    if (job) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    return payout;
  }

  async resume(
    userId: string,
    id: string,
    pin: string,
  ): Promise<ScheduledPayout> {
    await this.pinService.verifyPin(userId, pin);

    const payout = await this.repo.findOne({ where: { id, userId } });
    if (!payout) throw new NotFoundException('Scheduled payout not found');

    if (payout.status === Status.ACTIVE) return payout;

    payout.status = Status.ACTIVE;
    payout.nextRunAt = this.computeNextRun(
      payout.frequency,
      payout.dayOfWeek ?? undefined,
      payout.dayOfMonth ?? undefined,
    );
    await this.repo.save(payout);

    await this.queue.add(
      'scheduledPayout',
      { payoutId: payout.id },
      {
        jobId: `payout:${payout.id}`,
        repeat: { cron: this.cronExpression(payout) },
        removeOnComplete: true,
      },
    );

    return payout;
  }

  async cancel(userId: string, id: string): Promise<void> {
    const payout = await this.repo.findOne({ where: { id, userId } });
    if (!payout) throw new NotFoundException('Scheduled payout not found');

    payout.status = Status.CANCELLED;
    await this.repo.save(payout);

    const jobs = await this.queue.getRepeatableJobs();
    const job = jobs.find((j) => j.id === `payout:${payout.id}`);
    if (job) {
      await this.queue.removeRepeatableByKey(job.key);
    }
  }

  private computeNextRun(
    freq: Frequency,
    dayOfWeek?: number,
    dayOfMonth?: number,
  ): Date {
    const now = new Date();
    // Round to next hour/day for predictable UI
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);

    if (freq === Frequency.WEEKLY && dayOfWeek !== undefined) {
      next.setDate(now.getDate() + ((dayOfWeek + 7 - now.getDay()) % 7));
      if (next <= now) next.setDate(next.getDate() + 7);
      return next;
    }

    if (freq === Frequency.MONTHLY && dayOfMonth !== undefined) {
      next.setDate(Math.min(dayOfMonth, 28));
      if (next <= now) next.setMonth(next.getMonth() + 1);
      return next;
    }

    return now;
  }

  private cronExpression(payout: ScheduledPayout): string {
    if (payout.frequency === Frequency.WEEKLY && payout.dayOfWeek !== null) {
      return `0 9 * * ${payout.dayOfWeek}`; // every week at 9am
    }
    if (payout.frequency === Frequency.MONTHLY && payout.dayOfMonth !== null) {
      return `0 9 ${payout.dayOfMonth} * *`; // monthly at 9am
    }
    return '0 9 * * *';
  }
}
