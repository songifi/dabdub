import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import type { Job as BullJob } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduledPayout, Status, Frequency } from './entities/scheduled-payout.entity';
import { TransfersService } from '../transfers/transfers.service';
import { UsersService } from '../users/users.service';

@Processor('payouts')
export class PayoutsProcessor {
  private readonly logger = new Logger(PayoutsProcessor.name);

  constructor(
    @InjectRepository(ScheduledPayout)
    private readonly repo: Repository<ScheduledPayout>,
    private readonly transfersService: TransfersService,
    private readonly usersService: UsersService,
  ) {}

  @Process('scheduledPayout')
  async handleScheduledPayout(job: BullJob<{ payoutId: string }>) {
    const { payoutId } = job.data;
    const payout = await this.repo.findOne({ where: { id: payoutId } });

    if (!payout || payout.status !== Status.ACTIVE) {
      this.logger.warn(`Job ${job.id} skipped - payout ${payoutId} not active or found`);
      return;
    }

    this.logger.log(`Executing scheduled payout ${payoutId} for user ${payout.userId}`);

    try {
      const fromUser = await this.usersService.findById(payout.userId);
      if (!fromUser) {
        throw new Error(`User ${payout.userId} not found`);
      }

      await this.transfersService.create(payout.userId, fromUser.username, {
        toUsername: payout.toUsername,
        amount: payout.amount,
        note: payout.note ?? `Scheduled: ${payoutId}`,
      });

      payout.lastRunAt = new Date();
      payout.totalRuns += 1;
      payout.nextRunAt = this.computeNextRun(
        payout.frequency,
        payout.dayOfWeek ?? undefined,
        payout.dayOfMonth ?? undefined,
      );
      payout.failureCount = 0;
    } catch (err: any) {
      this.logger.error(`Failed to execute payout ${payoutId}: ${err.message}`);
      payout.failureCount += 1;
      if (payout.failureCount >= 2) {
        payout.status = Status.PAUSED;
      }
    }

    await this.repo.save(payout);
  }

  private computeNextRun(
    freq: Frequency,
    dayOfWeek?: number,
    dayOfMonth?: number,
  ): Date {
    const now = new Date();
    // Re-calculating correctly for next run
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
}
