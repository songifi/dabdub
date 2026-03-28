import { buildGdprExportPayload } from './gdpr-export.util';

describe('buildGdprExportPayload', () => {
  it('includes all required GDPR entity categories', () => {
    const payload = buildGdprExportPayload({
      userProfile: { id: 'u1' },
      wallet: { id: 'w1' },
      transactions: [],
      transfers: [],
      withdrawals: [],
      deposits: [],
      payLinks: [],
      contacts: [],
      notifications: [],
      supportTickets: [],
      loginHistory: [],
      deviceTokens: [] as any,
      kycSubmissions: [] as any,
      referrals: [],
      feedback: [],
    });

    const categories = (payload.categories ?? {}) as Record<string, unknown>;
    expect(categories.userProfile).toBeDefined();
    expect(categories.wallet).toBeDefined();
    expect(categories.transactions).toBeDefined();
    expect(categories.transfers).toBeDefined();
    expect(categories.withdrawals).toBeDefined();
    expect(categories.deposits).toBeDefined();
    expect(categories.payLinks).toBeDefined();
    expect(categories.contacts).toBeDefined();
    expect(categories.notifications).toBeDefined();
    expect(categories.supportTickets).toBeDefined();
    expect(categories.loginHistory).toBeDefined();
    expect(categories.deviceTokens).toBeDefined();
    expect(categories.kycSubmissions).toBeDefined();
    expect(categories.referrals).toBeDefined();
    expect(categories.feedback).toBeDefined();
  });
});
