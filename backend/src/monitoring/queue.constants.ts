/**
 * Bull queue names registered in AppModule (keep in sync with feature modules).
 * Used for Prometheus metrics and Bull Board.
 */
export const MONITORED_BULL_QUEUES = ['email-jobs', 'uploads', 'webhooks'] as const;

export type MonitoredBullQueueName = (typeof MONITORED_BULL_QUEUES)[number];
