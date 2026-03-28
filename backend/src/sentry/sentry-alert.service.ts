import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { ConfigService } from '@nestjs/config';

export interface PaymentErrorContext {
  transactionId?: string;
  userId?: string;
  amount?: string | number;
  currency?: string;
  paymentMethod?: string;
  errorCode?: string;
}

@Injectable()
export class SentryAlertService {
  private readonly logger = new Logger(SentryAlertService.name);
  private readonly slackWebhookUrl: string | null;

  constructor(private readonly configService: ConfigService) {
    this.slackWebhookUrl = this.configService.get<string>('SLACK_WEBHOOK_URL') || null;
  }

  /**
   * Capture a payment failure to Sentry with high severity
   * and send a Slack notification to #cheese-alerts channel.
   */
  async capturePaymentFailure(
    error: unknown,
    context: PaymentErrorContext,
  ): Promise<void> {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    // Set custom Sentry scope for payment errors
    Sentry.withScope((scope) => {
      scope.setTag('module', 'payments');
      scope.setLevel('error');

      if (context.transactionId) {
        scope.setTag('transactionId', context.transactionId);
      }
      if (context.userId) {
        scope.setTag('userId', context.userId);
      }
      if (context.amount) {
        scope.setExtra('amount', context.amount);
      }
      if (context.currency) {
        scope.setExtra('currency', context.currency);
      }
      if (context.paymentMethod) {
        scope.setExtra('paymentMethod', context.paymentMethod);
      }
      if (context.errorCode) {
        scope.setExtra('errorCode', context.errorCode);
      }

      // Capture the exception to Sentry
      Sentry.captureException(errorObj);
    });

    this.logger.error(
      `Payment failure captured: ${errorObj.message} (tx: ${context.transactionId || 'N/A'})`,
    );

    // Send Slack notification
    await this.sendSlackAlert(errorObj, context);
  }

  /**
   * Send a Slack notification to the #cheese-alerts channel.
   */
  private async sendSlackAlert(
    error: Error,
    context: PaymentErrorContext,
  ): Promise<void> {
    if (!this.slackWebhookUrl) {
      this.logger.warn('Slack webhook URL not configured, skipping alert');
      return;
    }

    const payload = {
      channel: '#cheese-alerts',
      username: 'Sentry Alerts',
      icon_emoji: ':rotating_light:',
      attachments: [
        {
          color: 'danger',
          title: '🚨 Payment Failure Alert',
          fields: [
            { title: 'Error', value: error.message, short: false },
            { title: 'Transaction ID', value: context.transactionId || 'N/A', short: true },
            { title: 'User ID', value: context.userId || 'N/A', short: true },
            { title: 'Amount', value: context.amount ? `${context.amount} ${context.currency || ''}` : 'N/A', short: true },
            { title: 'Payment Method', value: context.paymentMethod || 'N/A', short: true },
            { title: 'Error Code', value: context.errorCode || 'N/A', short: true },
            { title: 'Environment', value: process.env.NODE_ENV || 'development', short: true },
          ],
          footer: 'Sentry Alert',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    try {
      const response = await fetch(this.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.error(`Failed to send Slack alert: ${response.statusText}`);
      } else {
        this.logger.log('Slack alert sent successfully');
      }
    } catch (slackError) {
      this.logger.error(
        `Error sending Slack notification: ${slackError instanceof Error ? slackError.message : String(slackError)}`,
      );
    }
  }
}
