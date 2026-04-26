import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { Webhook } from './entities/webhook.entity';

const ALERT_THRESHOLDS = [
  { count: 3, urgency: 'warning', subject: 'Webhook endpoint failing' },
  { count: 7, urgency: 'high', subject: 'Webhook endpoint repeatedly failing — action required' },
  { count: 10, urgency: 'critical', subject: 'Webhook endpoint deactivated after 10 failures' },
] as const;

@Injectable()
export class WebhookFailureAlertService {
  private readonly logger = new Logger(WebhookFailureAlertService.name);

  constructor(private readonly notifications: NotificationsService) {}

  async notifyIfNeeded(
    webhook: Webhook,
    merchantEmail: string,
    lastError: string,
    webhookSettingsUrl: string,
  ): Promise<void> {
    const threshold = ALERT_THRESHOLDS.find((t) => t.count === webhook.failureCount);
    if (!threshold) return;

    const isDeactivated = webhook.failureCount >= 10;

    const text = [
      `Your webhook endpoint is experiencing failures.`,
      ``,
      `Endpoint: ${webhook.url}`,
      `Consecutive failures: ${webhook.failureCount}`,
      `Last error: ${lastError}`,
      `Urgency: ${threshold.urgency.toUpperCase()}`,
      isDeactivated
        ? `\nThis endpoint has been automatically deactivated. Please fix the issue and re-enable it.`
        : '',
      ``,
      `Manage your webhooks: ${webhookSettingsUrl}`,
    ]
      .join('\n')
      .trim();

    this.logger.warn(
      `Sending webhook failure alert to ${merchantEmail} for webhook ${webhook.id} (failures=${webhook.failureCount})`,
    );

    await this.notifications.enqueueEmail({
      recipient: merchantEmail,
      subject: threshold.subject,
      text,
    });
  }
}
