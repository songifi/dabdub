export const WEBHOOK_EVENTS = [
  'transfer.received',
  'paylink.paid',
  'settlement.completed',
  'deposit.confirmed',
  'withdrawal.confirmed',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
