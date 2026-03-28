import { Test, TestingModule } from '@nestjs/testing';
import { StellarAssetService } from './stellar-asset.service';
import { StellarService } from './stellar.service';
import { stellarConfig } from '../config/stellar.config';
import { AccountNotFundedException } from './stellar.exceptions';

const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

const mockConfig = {
  usdcIssuer: USDC_ISSUER,
  network: 'testnet' as const,
  rpcUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  contractId: 'CONTRACT_ID',
  adminSecretKey: 'SECRET',
  receiveAddress: 'RECEIVE_ADDRESS',
};

const mockStellarService = {
  loadAccount: jest.fn(),
  buildTransaction: jest.fn(),
  signTransaction: jest.fn(),
  submitTransaction: jest.fn(),
};

describe('StellarAssetService', () => {
  let service: StellarAssetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarAssetService,
        { provide: StellarService, useValue: mockStellarService },
        { provide: stellarConfig.KEY, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(StellarAssetService);
    jest.clearAllMocks();
  });

  describe('hasTrustLine', () => {
    it('returns false when USDC not in balances', async () => {
      mockStellarService.loadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '10.0000000' }],
        sequence: '1',
        signers: [],
      });

      expect(await service.hasTrustLine('GPUBKEY')).toBe(false);
    });

    it('returns true when USDC trust line exists with correct issuer', async () => {
      mockStellarService.loadAccount.mockResolvedValue({
        balances: [
          { asset_type: 'native', balance: '10.0000000' },
          { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: USDC_ISSUER, balance: '5.0000000' },
        ],
        sequence: '1',
        signers: [],
      });

      expect(await service.hasTrustLine('GPUBKEY')).toBe(true);
    });

    it('returns false when USDC exists but with wrong issuer', async () => {
      mockStellarService.loadAccount.mockResolvedValue({
        balances: [
          { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'WRONGISSUER', balance: '5.0000000' },
        ],
        sequence: '1',
        signers: [],
      });

      expect(await service.hasTrustLine('GPUBKEY')).toBe(false);
    });
  });

  describe('getUsdcBalance', () => {
    it("returns '0' for account with no trust line", async () => {
      mockStellarService.loadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '10.0000000' }],
        sequence: '1',
        signers: [],
      });

      expect(await service.getUsdcBalance('GPUBKEY')).toBe('0');
    });

    it('returns balance string when trust line exists', async () => {
      mockStellarService.loadAccount.mockResolvedValue({
        balances: [
          { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: USDC_ISSUER, balance: '42.5000000' },
        ],
        sequence: '1',
        signers: [],
      });

      expect(await service.getUsdcBalance('GPUBKEY')).toBe('42.5000000');
    });
  });

  describe('ensureTrustLine', () => {
    it('skips creation if trust line already exists', async () => {
      mockStellarService.loadAccount.mockResolvedValue({
        balances: [
          { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: USDC_ISSUER, balance: '0.0000000' },
        ],
        sequence: '1',
        signers: [],
      });

      await service.ensureTrustLine('GPUBKEY', 'SECRET');

      expect(mockStellarService.buildTransaction).not.toHaveBeenCalled();
      expect(mockStellarService.submitTransaction).not.toHaveBeenCalled();
    });

    it('creates trust line when missing', async () => {
      mockStellarService.loadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '10.0000000' }],
        sequence: '1',
        signers: [],
      });
      mockStellarService.buildTransaction.mockResolvedValue({} as any);
      mockStellarService.signTransaction.mockReturnValue('signed-xdr');
      mockStellarService.submitTransaction.mockResolvedValue({});

      await service.ensureTrustLine('GPUBKEY', 'SECRET');

      expect(mockStellarService.buildTransaction).toHaveBeenCalledTimes(1);
      expect(mockStellarService.submitTransaction).toHaveBeenCalledWith('signed-xdr');
    });
  });

  describe('createTrustLine', () => {
    it('throws AccountNotFundedException when XLM balance is too low', async () => {
      mockStellarService.loadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '0.5000000' }],
        sequence: '1',
        signers: [],
      });

      await expect(service.createTrustLine('GPUBKEY', 'SECRET')).rejects.toThrow(
        AccountNotFundedException,
      );
    });
  });
});
