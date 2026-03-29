import type { JobsOptions } from 'bullmq';

export const QUEUE_NAMES = [
  'blockchain-jobs',
  'email-jobs',
  'sms-jobs',
  'settlement-jobs',
  'notification-jobs',
  'rate-jobs',
  'fraud-jobs',
  'report-jobs',
  'referral-jobs',
  'support-jobs',
  'offramp-jobs',
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

export const QUEUE_DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 500 },
};

export const BULL_BOARD_PATH = '/admin/queues';
