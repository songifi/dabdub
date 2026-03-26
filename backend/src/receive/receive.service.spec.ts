import { Test, TestingModule } from '@nestjs/testing';
import { ReceiveService } from './receive.service';
import { stellarConfig } from '../config/stellar.config';
import { appConfig } from '../config/app.config';
import { VirtualAccountService } from '../virtual-account/virtual-account.service';
import { PayLinkService } from '../paylink/paylink.service';
import { CacheService } from '../cache/cache.service';
import { User } from '../users/entities/user.entity';
import { VirtualAccountProvider } from '../virtual-account/entities/virtual-account.entity';
import { PayLinkStatus } from '../paylink/entities/pay-link.entity';

const STELLAR_ADDR = 'GBBM6BKZPEHWYOESEOTMOVALSRHVHXJ4Q2GWQYLBBZYH4M4XBRZECV2T';
const STELLAR_ISSUER = 'GBBM6BKZPEHWYOESEOTMOVALSRHVHXJ4Q2GWQYLBBZYH4M4XBRZECV2T';

function mockUser(overrides: Partial<User> = {}): User {
  return { id: 'user-uuid-1', username: 'alice', ...overrides } as User;
}

describe('ReceiveService', () => {
  let service: ReceiveService;
  const mockVa = {
    findExistingByUserId: jest.fn(),
    getOrProvision: jest.fn(),
  };
  const mockPay = {
    countActiveReceiveLinks: jest.fn(),
    create: jest.fn(),
  };
  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiveService,
        {
          provide: stellarConfig.KEY,
          useValue: {
            receiveAddress: STELLAR_ADDR,
            usdcIssuer: STELLAR_ISSUER,
          },
        },
        {
          provide: appConfig.KEY,
          useValue: { frontendUrl: 'https://app.example.com' },
        },
        { provide: VirtualAccountService, useValue: mockVa },
        { provide: PayLinkService, useValue: mockPay },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get(ReceiveService);
  });

  it('getInfo returns stellar, memo, virtualAccount null when none stored, and paylink count', async () => {
    mockVa.findExistingByUserId.mockResolvedValue(null);
    mockPay.countActiveReceiveLinks.mockResolvedValue(2);

    const user = mockUser();
    const info = await service.getInfo(user);

    expect(info).toEqual({
      stellarAddress: STELLAR_ADDR,
      memo: 'alice',
      virtualAccount: null,
      paylinks: 2,
    });
    expect(mockVa.findExistingByUserId).toHaveBeenCalledWith('user-uuid-1');
    expect(mockVa.getOrProvision).not.toHaveBeenCalled();
  });

  it('getInfo includes VA when one exists', async () => {
    mockVa.findExistingByUserId.mockResolvedValue({
      accountNumber: '123',
      bankName: 'Test Bank',
      reference: 'va_ref',
      provider: VirtualAccountProvider.FLUTTERWAVE,
    });
    mockPay.countActiveReceiveLinks.mockResolvedValue(0);

    const info = await service.getInfo(mockUser());

    expect(info.virtualAccount).toEqual({
      accountNumber: '123',
      bankName: 'Test Bank',
      reference: 'va_ref',
    });
  });

  it('getVirtualAccountReceive lazy-provisions via getOrProvision', async () => {
    mockVa.getOrProvision.mockResolvedValue({
      accountNumber: '987',
      bankName: 'FW',
      reference: 'va_user-uuid-1_1',
      provider: VirtualAccountProvider.FLUTTERWAVE,
    });

    const row = await service.getVirtualAccountReceive(mockUser());

    expect(mockVa.getOrProvision).toHaveBeenCalledWith('user-uuid-1');
    expect(row).toMatchObject({
      accountNumber: '987',
      bankName: 'FW',
      reference: 'va_user-uuid-1_1',
      amountNote: expect.stringContaining('NGN') as string,
    });
  });

  it('buildStellarPaymentUri matches SEP-style web+stellar query', () => {
    const uri = service.buildStellarPaymentUri(STELLAR_ADDR, 'alice', STELLAR_ISSUER);
    expect(uri.startsWith('web+stellar:pay?')).toBe(true);
    expect(uri).toContain(`destination=${STELLAR_ADDR}`);
    expect(uri).toContain('memo=alice');
    expect(uri).toContain('memo_type=text');
    expect(uri).toContain('asset_code=USDC');
    expect(uri).toContain(`asset_issuer=${STELLAR_ISSUER}`);
  });

  it('getStellarReceive returns qrDataUrl PNG base64', async () => {
    const res = await service.getStellarReceive(mockUser());
    expect(res.address).toBe(STELLAR_ADDR);
    expect(res.memo).toBe('alice');
    expect(res.network).toBe('stellar');
    expect(res.assetCode).toBe('USDC');
    expect(res.assetIssuer).toBe(STELLAR_ISSUER);
    expect(res.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('getQrBundle returns three valid PNG data URLs and caches', async () => {
    mockVa.getOrProvision.mockResolvedValue({
      accountNumber: '111',
      bankName: 'Bank',
      reference: 'ref1',
      provider: VirtualAccountProvider.FLUTTERWAVE,
    });

    const bundle = await service.getQrBundle(mockUser());

    expect(bundle.stellarQr).toMatch(/^data:image\/png;base64,/);
    expect(bundle.virtualAccountQr).toMatch(/^data:image\/png;base64,/);
    expect(bundle.usernameQr).toMatch(/^data:image\/png;base64,/);
    expect(mockCache.set).toHaveBeenCalledWith(
      'receive:qr:user-uuid-1',
      bundle,
      3600,
    );
  });

  it('getQrBundle returns cached payload without re-provisioning', async () => {
    const cached = {
      stellarQr: 'data:image/png;base64,AAA',
      virtualAccountQr: 'data:image/png;base64,BBB',
      usernameQr: 'data:image/png;base64,CCC',
    };
    mockCache.get.mockResolvedValue(cached);

    const bundle = await service.getQrBundle(mockUser());

    expect(bundle).toBe(cached);
    expect(mockVa.getOrProvision).not.toHaveBeenCalled();
  });

  it('createPaylinkFromReceive delegates to PayLinkService.create', async () => {
    mockPay.create.mockResolvedValue({
      tokenId: 'tokABC123',
      amount: '10',
      status: PayLinkStatus.ACTIVE,
    });

    const user = mockUser();
    const out = await service.createPaylinkFromReceive(user, {
      amount: '10',
      note: 'hi',
      expiresInHours: 24,
    });

    expect(mockPay.create).toHaveBeenCalledWith(user, {
      amount: '10',
      note: 'hi',
      expiresInHours: 24,
    });
    expect(out.paylinkUrl).toBe('https://app.example.com/paylinks/tokABC123');
    expect(out.tokenId).toBe('tokABC123');
    expect(out.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
