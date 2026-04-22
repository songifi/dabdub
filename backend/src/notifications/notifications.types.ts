export const NotificationType = {
  TRANSFER_RECEIVED: 'transfer_received',
  TRANSFER_SENT: 'transfer_sent',
  WITHDRAWAL_CONFIRMED: 'withdrawal_confirmed',
  PAYLINK_PAID: 'paylink_paid',
  DEPOSIT_CONFIRMED: 'deposit_confirmed',
  KYC_UPDATE: 'kyc_update',
  TIER_UPGRADED: 'tier_upgraded',
  SYSTEM: 'system',
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

