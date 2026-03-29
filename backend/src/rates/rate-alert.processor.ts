import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { FIRE_RATE_ALERT_JOB, RATE_ALERT_QUEUE, FireRateAlertPayload } from './rate-alert.service';
import { NotificationService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notifications.types';
import { PushService } from '../push/push.service';
import { EmailService } from '../email/email.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RateAlert } from './entities/rate-alert.entity';
import { User } from '../users/entities/user.entity';

function formatNgn(value: string): string {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString('en-NG', { maximumFractionDigits: 2 });
}

@Processor(RATE_ALERT_QUEUE)
export class RateAlertProcessor {
  private readonly logger = new Logger(RateAlertProcessor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly pushService: PushService,
    private readonly emailService: EmailService,
    @InjectRepository(RateAlert)
    private readonly alertRepo: Repository<RateAlert>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Process(FIRE_RATE_ALERT_JOB)
  async handleFireAlert(job: Job<FireRateAlertPayload>): Promise<void> {
    const { alertId, userId, targetRate, currentRate } = job.data;
    const t = formatNgn(targetRate);
    const c = formatNgn(currentRate);
    const message = `NGN/USDC rate hit your target of ₦${t}. Current rate: ₦${c}`;

    const channels: string[] = [];

    try {
      await this.pushService.send(userId, {
        title: 'Rate Alert Triggered',
        body: message,
      });
      channels.push('push');
    } catch (err) {
      this.logger.warn(`Push failed for alert ${alertId}: ${(err as Error).message}`);
    }

    try {
      await this.notificationService.create(
        userId,
        NotificationType.SYSTEM,
        'Rate Alert Triggered',
        message,
        { alertId, targetRate, currentRate },
      );
      channels.push('in_app');
    } catch (err) {
      this.logger.warn(`In-app notification failed for alert ${alertId}: ${(err as Error).message}`);
    }

    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (user?.email) {
        await this.emailService.queue(
          user.email,
          'rate-alert-triggered',
          { targetRate: t, currentRate: c, message },
          userId,
        );
        channels.push('email');
      } else {
        this.logger.warn(`No email for user ${userId}; skipping rate alert email`);
      }
    } catch (err) {
      this.logger.warn(`Email failed for alert ${alertId}: ${(err as Error).message}`);
    }

    await this.alertRepo.update(alertId, { notifiedVia: channels });
    this.logger.log(`Rate alert ${alertId} fired via: ${channels.join(', ')}`);
  }
}
