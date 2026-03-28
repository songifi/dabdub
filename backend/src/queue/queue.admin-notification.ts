import { Injectable, Logger } from '@nestjs/common';
import { CheeseGateway, WS_EVENTS } from '../ws/cheese.gateway';
import type { DeadLetterNotification } from './queue.types';

@Injectable()
export class QueueAdminNotificationService {
  private readonly logger = new Logger(QueueAdminNotificationService.name);

  constructor(private readonly gateway: CheeseGateway) {}

  async notifyDeadLetter(notification: DeadLetterNotification): Promise<void> {
    this.logger.warn(
      `Broadcasting dead-letter alert for queue=${notification.queueName} jobId=${notification.jobId}`,
    );

    await this.gateway.emitToAdmins(WS_EVENTS.SYSTEM_MESSAGE, {
      type: 'queue.dead-letter',
      severity: 'error',
      ...notification,
    });
  }
}
