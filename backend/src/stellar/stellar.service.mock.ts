import { StellarService } from './stellar.service';

type DeepPartial<T> = { [K in keyof T]?: T[K] };

export const defaultMockStellarService: DeepPartial<StellarService> = {
  getDepositAddress: jest.fn().mockReturnValue('GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
  generateMemo: jest.fn().mockReturnValue('TESTMEMO'),
  getXlmUsdRate: jest.fn().mockResolvedValue(0.1),
  getAccountTransactions: jest.fn().mockResolvedValue([]),
  getPaymentsForTransaction: jest.fn().mockResolvedValue([]),
  verifyPayment: jest
    .fn()
    .mockResolvedValue({ verified: true, amount: 50, asset: 'USDC' }),
  sendPayment: jest.fn().mockResolvedValue('mock-tx-hash-abc123'),
  getUsdcAsset: jest.fn().mockReturnValue({ code: 'USDC', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' }),
  getServer: jest.fn().mockReturnValue({}),
};

export function createMockStellarService(
  overrides: DeepPartial<StellarService> = {},
): DeepPartial<StellarService> {
  return { ...defaultMockStellarService, ...overrides };
}
