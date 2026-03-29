import { ScheduledPayout, Frequency, Status } from "../entities/ScheduledPayout";
import { getRepository } from "typeorm";
import { TransfersService } from "./TransfersService";
import { bullQueue } from "../utils/bullmq";

export class ScheduledPayoutService {
  private repo = getRepository(ScheduledPayout);

  async create(userId: string, dto: any, pin: string) {
    // Verify PIN
    if (!(await this.verifyPin(userId, pin))) throw new Error("Invalid PIN");

    const payout = this.repo.create({
      userId,
      toUsername: dto.toUsername,
      amountUsdc: dto.amountUsdc,
      note: dto.note,
      frequency: dto.frequency,
      dayOfWeek: dto.dayOfWeek ?? null,
      dayOfMonth: dto.dayOfMonth ? Math.min(dto.dayOfMonth, 28) : null,
      nextRunAt: this.computeNextRun(dto.frequency, dto.dayOfWeek, dto.dayOfMonth),
      status: Status.ACTIVE,
    });

    await this.repo.save(payout);

    await bullQueue.add(
      "scheduledPayout",
      { payoutId: payout.id },
      { jobId: `payout:${payout.id}`, repeat: { cron: this.cronExpression(payout) } }
    );

    return payout;
  }

  async execute(payoutId: string) {
    const payout = await this.repo.findOneOrFail(payoutId);

    try {
      await TransfersService.create(payout.userId, {
        toUsername: payout.toUsername,
        amountUsdc: payout.amountUsdc,
        note: payout.note,
        reference: `scheduled:${payout.id}`,
      });

      payout.lastRunAt = new Date();
      payout.totalRuns += 1;
      payout.nextRunAt = this.computeNextRun(payout.frequency, payout.dayOfWeek, payout.dayOfMonth);
      payout.failureCount = 0;
    } catch (err) {
      payout.failureCount += 1;
      if (payout.failureCount >= 2) {
        payout.status = Status.PAUSED;
        await this.notifyUser(payout.userId, "Scheduled payout paused after repeated failures.");
      }
    }

    await this.repo.save(payout);
  }

  async pause(payoutId: string, userId: string) {
    const payout = await this.repo.findOneOrFail({ where: { id: payoutId, userId } });
    payout.status = Status.PAUSED;
    await this.repo.save(payout);
    await bullQueue.removeRepeatableByKey(`payout:${payout.id}`);
  }

  async resume(payoutId: string, userId: string, pin: string) {
    if (!(await this.verifyPin(userId, pin))) throw new Error("Invalid PIN");
    const payout = await this.repo.findOneOrFail({ where: { id: payoutId, userId } });
    payout.status = Status.ACTIVE;
    payout.nextRunAt = this.computeNextRun(payout.frequency, payout.dayOfWeek, payout.dayOfMonth);
    await this.repo.save(payout);

    await bullQueue.add(
      "scheduledPayout",
      { payoutId: payout.id },
      { jobId: `payout:${payout.id}`, repeat: { cron: this.cronExpression(payout) } }
    );
  }

  async cancel(payoutId: string, userId: string) {
    const payout = await this.repo.findOneOrFail({ where: { id: payoutId, userId } });
    payout.status = Status.CANCELLED;
    await this.repo.save(payout);
    await bullQueue.removeRepeatableByKey(`payout:${payout.id}`);
  }

  private computeNextRun(freq: Frequency, dayOfWeek?: number, dayOfMonth?: number): Date {
    const now = new Date();
    if (freq === Frequency.WEEKLY && dayOfWeek !== undefined) {
      const next = new Date(now);
      next.setDate(now.getDate() + ((dayOfWeek + 7 - now.getDay()) % 7));
      return next;
    }
    if (freq === Frequency.MONTHLY && dayOfMonth !== undefined) {
      const next = new Date(now.getFullYear(), now.getMonth(), Math.min(dayOfMonth, 28));
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
    return "0 9 * * *";
  }

  private async verifyPin(userId: string, pin: string): Promise<boolean> {
    // Implement PIN verification logic
    return true;
  }

  private async notifyUser(userId: string, message: string) {
    // Implement notification logic
    console.log(`Notify ${userId}: ${message}`);
  }
}
