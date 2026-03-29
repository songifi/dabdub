import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import * as Sentry from '@sentry/nestjs';
import {
  MaintenanceService,
  MAINTENANCE_QUEUE,
  MaintenanceJobPayload,
} from './maintenance.service';
import { MaintenanceStatus } from './entities/maintenance-window.entity';
import { CheeseGateway, WS_EVENTS } from '../ws/cheese.gateway';
import { EmailService } from '../email/email.service';
import { PushService } from '../push/push.service';
import { UsersService } from '../users/users.service';

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly wsGateway: CheeseGateway,
    private readonly emailService: EmailService,
    private readonly pushService: PushService,
    private readonly usersService: UsersService,
  ) {}

  @Process()
  async handleMaintenanceJob(job: Job<MaintenanceJobPayload>): Promise<void> {
    const { windowId, action } = job.data;

    await Sentry.startSpan(
      {
        op: 'bullmq.job',
        name: `process.${MAINTENANCE_QUEUE}.${action}`,
        attributes: {
          queue: MAINTENANCE_QUEUE,
          jobType: action,
          jobId: job.id?.toString() || 'unknown',
          windowId,
        },
      },
      async () => {
        switch (action) {
          case 'start':
            await this.handleStart(windowId);
            break;
          case 'end':
            await this.handleEnd(windowId);
            break;
          case 'notify_24h':
            await this.handleNotification(windowId, '24 hours');
            break;
          case 'notify_1h':
            await this.handleNotification(windowId, '1 hour');
            break;
          case 'cancel_notify':
            await this.handleCancelNotify(windowId);
            break;
          default:
            this.logger.warn(`Unknown maintenance action: ${action}`);
        }
      }
    );
  }

  @OnQueueFailed()
  async handleFailed(job: Job<MaintenanceJobPayload>, error: Error): Promise<void> {
    const { windowId, action } = job.data;
    
    this.logger.error(
      `Maintenance job failed: windowId=${windowId} action=${action} error=${error.message}`,
      error.stack,
    );
    
    Sentry.captureException(error, {
      tags: {
        queue: MAINTENANCE_QUEUE,
        action,
        windowId,
      },
    });
  }

  private async handleStart(windowId: string): Promise<void> {
    try {
      const window = await this.maintenanceService.findById(windowId);
      if (window.status !== MaintenanceStatus.SCHEDULED) {
        this.logger.warn(
          `Skip maintenance start for ${windowId}: status=${window.status}`,
        );
        return;
      }

      await this.maintenanceService.setActive(windowId);

      this.wsGateway.emitToAll(WS_EVENTS.SYSTEM_MAINTENANCE_START, {
        id: window.id,
        title: window.title,
        description: window.description,
        estimatedRestoration: window.endAt,
        affectedServices: window.affectedServices,
      });

      this.logger.log(`Maintenance window started: ${windowId}`);
    } catch (error) {
      this.logger.error(`Failed to start maintenance window ${windowId}:`, error);
      throw error;
    }
  }

  private async handleEnd(windowId: string): Promise<void> {
    try {
      const window = await this.maintenanceService.findById(windowId);
      if (window.status !== MaintenanceStatus.ACTIVE) {
        this.logger.warn(`Skip maintenance end for ${windowId}: status=${window.status}`);
        return;
      }

      await this.maintenanceService.setCompleted(windowId);

      this.wsGateway.emitToAll(WS_EVENTS.SYSTEM_MAINTENANCE_END, {
        id: window.id,
        title: window.title,
      });

      this.logger.log(`Maintenance window completed: ${windowId}`);
    } catch (error) {
      this.logger.error(`Failed to end maintenance window ${windowId}:`, error);
      throw error;
    }
  }

  private async handleNotification(windowId: string, timeframe: string): Promise<void> {
    try {
      const window = await this.maintenanceService.findById(windowId);
      if (window.status !== MaintenanceStatus.SCHEDULED) {
        this.logger.warn(
          `Skip maintenance reminder for ${windowId}: status=${window.status}`,
        );
        return;
      }

      const activeUsers = await this.usersService.findActiveUsers();
      
      const subject = `Scheduled Maintenance in ${timeframe}`;
      const message = `${window.title} is scheduled to begin in ${timeframe}. ${window.description}`;
      
      // Send push notifications
      const pushPayload = {
        title: subject,
        body: message,
        data: {
          type: 'maintenance_notification',
          windowId: window.id,
          timeframe,
        },
      };
      
      // Send to all active users in batches
      const userIds = activeUsers.map(user => user.id);
      await this.pushService.sendBulk(userIds, pushPayload);
      
      // Send email notifications
      const greetingName = (u: { displayName?: string | null; username: string }) =>
        u.displayName?.trim() || u.username;

      for (const user of activeUsers) {
        await this.emailService.queue(
          user.email,
          'maintenance-notification',
          {
            firstName: greetingName(user),
            title: window.title,
            description: window.description,
            startTime: window.startAt.toISOString(),
            endTime: window.endAt.toISOString(),
            timeframe,
          },
        );
      }
      
      this.logger.log(`Sent ${timeframe} maintenance notifications for window ${windowId} to ${activeUsers.length} users`);
    } catch (error) {
      this.logger.error(`Failed to send maintenance notifications for window ${windowId}:`, error);
      throw error;
    }
  }

  private async handleCancelNotify(windowId: string): Promise<void> {
    try {
      const window = await this.maintenanceService.findById(windowId);
      if (window.status !== MaintenanceStatus.CANCELLED) {
        return;
      }

      const activeUsers = await this.usersService.findActiveUsers();
      const subject = 'Scheduled maintenance cancelled';
      const body = `${window.title} is no longer scheduled.`;

      await this.pushService.sendBulk(activeUsers.map((u) => u.id), {
        title: subject,
        body,
        data: {
          type: 'maintenance_cancelled',
          windowId: window.id,
        },
      });

      const greetingName = (u: { displayName?: string | null; username: string }) =>
        u.displayName?.trim() || u.username;

      for (const user of activeUsers) {
        await this.emailService.queue(user.email, 'maintenance-cancelled', {
          firstName: greetingName(user),
          title: window.title,
          description: window.description,
          startTime: window.startAt.toISOString(),
          endTime: window.endAt.toISOString(),
        });
      }

      this.wsGateway.emitToAll(WS_EVENTS.SYSTEM_MAINTENANCE_CANCELLED, {
        id: window.id,
        title: window.title,
      });

      this.logger.log(`Sent cancellation notices for maintenance window ${windowId}`);
    } catch (error) {
      this.logger.error(`Failed to notify cancellation for ${windowId}:`, error);
      throw error;
    }
  }
}