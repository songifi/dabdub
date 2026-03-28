import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PayLinkStatus } from '../paylink/entities/pay-link.entity';
import { SandboxService } from './sandbox.service';

describe('SandboxService', () => {
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    incrbyfloat: jest.fn(),
    lpush: jest.fn(),
    ltrim: jest.fn(),
    unlink: jest.fn(),
  };

  const payLinkRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const userRepo = {
    findOne: jest.fn(),
  };

  const payLinkService = {
    create: jest.fn(),
  };

  const webhooks = {
    dispatch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('simulatePayment marks paid and dispatches sandbox webhook', async () => {
    const service = new SandboxService(
      redis as any,
      payLinkRepo as any,
      userRepo as any,
      payLinkService as any,
      webhooks as any,
    );

    payLinkRepo.findOne.mockResolvedValue({
      tokenId: 'TOKEN123',
      creatorUserId: 'merchant-1',
      sandbox: true,
      status: PayLinkStatus.ACTIVE,
      amount: '50.00',
      expiresAt: new Date(Date.now() + 60_000),
    });
    payLinkRepo.save.mockImplementation(async (x: any) => x);

    redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce('10000.000000');
    redis.incrbyfloat.mockResolvedValue('10050.000000');

    const res = await service.simulatePayment('merchant-1', 'TOKEN123');

    expect(payLinkRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: PayLinkStatus.PAID,
      }),
    );
    expect(webhooks.dispatch).toHaveBeenCalledWith(
      'paylink.paid',
      expect.objectContaining({ sandbox: true, tokenId: 'TOKEN123' }),
      'merchant-1',
    );
    expect(res.txHash).toMatch(/^sandbox_/);
  });

  it('resetBalance restores 10,000 USDC and clears sandbox transactions', async () => {
    const service = new SandboxService(
      redis as any,
      payLinkRepo as any,
      userRepo as any,
      payLinkService as any,
      webhooks as any,
    );

    const res = await service.resetBalance('merchant-1');

    expect(redis.set).toHaveBeenCalledWith(
      'sandbox:balance:merchant-1:USDC',
      '10000.000000',
    );
    expect(redis.unlink).toHaveBeenCalledWith('sandbox:transactions:merchant-1');
    expect(res.balanceUsdc).toBe('10000.000000');
  });
});
