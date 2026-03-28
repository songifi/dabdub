import type { Job } from 'bullmq';
import type { QueueName } from './queue.constants';

export type QueueJobHandler = (job: Job) => Promise<unknown>;

export interface DeadLetterNotification {
  queueName: QueueName;
  jobId: string;
  jobName: string;
  attemptsMade: number;
  failedReason: string;
  payload: unknown;
  options: unknown;
}
