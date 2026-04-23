export const QUEUE_NAMES = {
  settlement: 'settlement',
  webhook: 'webhook',
  notification: 'notification',
  stellarMonitor: 'stellar-monitor',
} as const;

export const QUEUE_LIST = Object.values(QUEUE_NAMES);

export const DEFAULT_QUEUE_JOB = 'dispatch';
