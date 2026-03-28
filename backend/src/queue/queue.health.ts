import { Injectable, Logger } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { QUEUE_NAMES } from './queue.constants';
import { QueueRegistryService } from './queue.registry';

@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(QueueHealthIndicator.name);

  constructor(private readonly registry: QueueRegistryService) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      const redisReply = await this.registry.ping();
      if (redisReply !== 'PONG') {
        throw new Error(`Unexpected Redis ping response: ${redisReply}`);
      }

      const inactiveQueues = QUEUE_NAMES.filter(
        (queueName) => !this.registry.hasActiveWorker(queueName),
      );

      if (inactiveQueues.length > 0) {
        throw new Error(
          `No active worker registered for: ${inactiveQueues.join(', ')}`,
        );
      }

      return this.getStatus(key, true, {
        redis: redisReply,
        workers: this.registry.getWorkerStates(),
      });
    } catch (error) {
      this.logger.warn(
        `Queue health check failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      const result = this.getStatus(key, false, {
        message: error instanceof Error ? error.message : String(error),
        workers: this.registry.getWorkerStates(),
      });
      throw new HealthCheckError(`${key} is down`, result);
    }
  }
}
