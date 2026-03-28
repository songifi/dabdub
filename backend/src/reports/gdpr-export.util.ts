import { DeviceToken } from '../push/entities/device-token.entity';
import { KycSubmission } from '../kyc/entities/kyc-submission.entity';

export interface GdprExportCollections {
  userProfile: unknown;
  wallet: unknown;
  transactions: unknown[];
  transfers: unknown[];
  withdrawals: unknown[];
  deposits: unknown[];
  payLinks: unknown[];
  contacts: unknown[];
  notifications: unknown[];
  supportTickets: unknown[];
  loginHistory: unknown[];
  deviceTokens: DeviceToken[];
  kycSubmissions: KycSubmission[];
  referrals: unknown[];
  feedback: unknown[];
}

export function buildGdprExportPayload(input: GdprExportCollections): Record<string, unknown> {
  return {
    generatedAt: new Date().toISOString(),
    categories: {
      userProfile: input.userProfile,
      wallet: input.wallet,
      transactions: input.transactions,
      transfers: input.transfers,
      withdrawals: input.withdrawals,
      deposits: input.deposits,
      payLinks: input.payLinks,
      contacts: input.contacts,
      notifications: input.notifications,
      supportTickets: input.supportTickets,
      loginHistory: input.loginHistory,
      deviceTokens: input.deviceTokens.map((token) => ({
        id: token.id,
        userId: token.userId,
        platform: token.platform,
        isActive: token.isActive,
        lastUsedAt: token.lastUsedAt,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
      })),
      kycSubmissions: input.kycSubmissions.map((submission) => ({
        id: submission.id,
        userId: submission.userId,
        targetTier: submission.targetTier,
        status: submission.status,
        reviewedAt: submission.reviewedAt,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
      })),
      referrals: input.referrals,
      feedback: input.feedback,
    },
  };
}

export const GDPR_EXPORT_README = `Cheese Personal Data Export\n\nThis archive contains your personal data as held by Cheese at the time of export.\n\nIncluded categories:\n- userProfile: account profile data\n- wallet: wallet profile and balances\n- transactions: account transaction history\n- transfers: transfer records\n- withdrawals: withdrawal records\n- deposits: deposit records\n- payLinks: links created and payment states\n- contacts: counterparties inferred from transfer/transaction activity\n- notifications: in-app notifications\n- supportTickets: support tickets linked to your account\n- loginHistory: login attempts and metadata\n- deviceTokens: device metadata only (token and web subscription values excluded)\n- kycSubmissions: KYC statuses only (document keys excluded)\n- referrals: referral records\n- feedback: submitted feedback records\n`;
