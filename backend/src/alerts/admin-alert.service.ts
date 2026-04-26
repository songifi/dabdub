import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import {
  AdminAlert,
  AdminAlertStatus,
  AdminAlertType,
} from './admin-alert.entity';

interface RaiseAlertInput {
  type: AdminAlertType;
  dedupeKey: string;
  message: string;
  metadata?: Record<string, unknown>;
  thresholdValue: number;
}

@Injectable()
export class AdminAlertService {
  private readonly logger = new Logger(AdminAlertService.name);

  constructor(
    @InjectRepository(AdminAlert)
    private readonly adminAlertRepo: Repository<AdminAlert>,
    private readonly config: ConfigService,
  ) {}

  async raise(input: RaiseAlertInput): Promise<AdminAlert | null> {
    if (!this.meetsThreshold(input.type, input.thresholdValue)) {
      return null;
    }

    const now = new Date();
    const existing = await this.adminAlertRepo.findOne({
      where: {
        type: input.type,
        dedupeKey: input.dedupeKey,
      },
    });

    if (existing) {
      existing.message = input.message;
      existing.metadata = input.metadata ?? null;
      existing.thresholdValue = input.thresholdValue;
      existing.occurrenceCount += 1;

      if (this.isCoolingDown(existing, now)) {
        return this.adminAlertRepo.save(existing);
      }

      existing.status = AdminAlertStatus.OPEN;
      existing.acknowledgedAt = null;
      existing.acknowledgedBy = null;
      existing.lastNotifiedAt = now;

      const saved = await this.adminAlertRepo.save(existing);
      await this.notify(saved);
      return saved;
    }

    const created = this.adminAlertRepo.create({
      type: input.type,
      dedupeKey: input.dedupeKey,
      message: input.message,
      metadata: input.metadata ?? null,
      thresholdValue: input.thresholdValue,
      occurrenceCount: 1,
      lastNotifiedAt: now,
      status: AdminAlertStatus.OPEN,
      acknowledgedAt: null,
      acknowledgedBy: null,
    });

    const saved = await this.adminAlertRepo.save(created);
    await this.notify(saved);
    return saved;
  }

  async list(): Promise<AdminAlert[]> {
    return this.adminAlertRepo.find({
      order: {
        updatedAt: 'DESC',
      },
    });
  }

  async acknowledge(id: string, adminId: string): Promise<AdminAlert> {
    const alert = await this.adminAlertRepo.findOne({ where: { id } });
    if (!alert) {
      throw new NotFoundException(`AdminAlert ${id} not found`);
    }

    alert.status = AdminAlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = adminId;
    return this.adminAlertRepo.save(alert);
  }

  private meetsThreshold(type: AdminAlertType, value: number): boolean {
    if (type === AdminAlertType.STELLAR_MONITOR) {
      return value >= this.getNumberEnv('ADMIN_ALERT_STELLAR_FAILURE_THRESHOLD', 1);
    }

    return value >= this.getNumberEnv('ADMIN_ALERT_FAILURE_THRESHOLD', 1);
  }

  private isCoolingDown(alert: AdminAlert, now: Date): boolean {
    if (!alert.lastNotifiedAt) {
      return false;
    }

    const cooldownMs =
      this.getNumberEnv('ADMIN_ALERT_COOLDOWN_MINUTES', 30) * 60_000;
    return now.getTime() - alert.lastNotifiedAt.getTime() < cooldownMs;
  }

  private async notify(alert: AdminAlert): Promise<void> {
    await Promise.allSettled([
      this.notifySlack(alert),
      this.notifyEmail(alert),
    ]);
  }

  private async notifySlack(alert: AdminAlert): Promise<void> {
    const webhookUrl = this.config.get<string>('ADMIN_ALERT_SLACK_WEBHOOK_URL');
    if (!webhookUrl) {
      return;
    }

    const response = await axios.post(
      webhookUrl,
      {
        text: `[${alert.type}] ${alert.message}`,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
      },
    );

    if (response.status >= 400) {
      this.logger.warn(`Slack alert delivery failed with HTTP ${response.status}`);
    }
  }

  private async notifyEmail(alert: AdminAlert): Promise<void> {
    const emailRecipient = this.config.get<string>('ADMIN_ALERT_EMAIL');
    const zeptoApiKey = this.config.get<string>('ZEPTOMAIL_API_KEY');
    const zeptoFromEmail = this.config.get<string>('ZEPTOMAIL_FROM_EMAIL');

    if (!emailRecipient || !zeptoApiKey || !zeptoFromEmail) {
      return;
    }

    const response = await axios.post(
      'https://api.zeptomail.com/v1.1/email',
      {
        from: {
          address: zeptoFromEmail,
        },
        to: [
          {
            email_address: {
              address: emailRecipient,
            },
          },
        ],
        subject: `[Admin Alert] ${alert.type}`,
        htmlbody: `<p>${alert.message}</p><pre>${JSON.stringify(
          alert.metadata ?? {},
          null,
          2,
        )}</pre>`,
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          authorization: zeptoApiKey,
        },
        validateStatus: () => true,
      },
    );

    if (response.status >= 400) {
      this.logger.warn(`Email alert delivery failed with HTTP ${response.status}`);
    }
  }

  private getNumberEnv(name: string, fallback: number): number {
    const value = this.config.get<string>(name);
    return value ? Number(value) : fallback;
  }
}
