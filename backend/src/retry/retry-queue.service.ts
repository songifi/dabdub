import { Injectable, Logger } from '@nestjs/common';
import { RetryConfig } from './retry-config.service';

@Injectable()
export class RetryQueueService {
  private readonly logger = new Logger(RetryQueueService.name);

  /**
   * Executes `task` and retries on failure according to `config`.
   * Delays between attempts are taken from config.delaysMs by index (last value repeated if needed).
   */
  async run<T>(
    name: string,
    config: RetryConfig,
    task: () => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= config.maxAttempts; attempt++) {
      try {
        return await task();
      } catch (err) {
        lastError = err;
        if (attempt === config.maxAttempts) break;

        const delayMs =
          config.delaysMs[Math.min(attempt, config.delaysMs.length - 1)];

        this.logger.warn(
          `[${name}] attempt ${attempt + 1}/${config.maxAttempts} failed: ${(err as Error).message}. ` +
            (delayMs > 0 ? `Retrying in ${delayMs}ms…` : 'Retrying immediately…'),
        );

        if (delayMs > 0) await this.sleep(delayMs);
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
