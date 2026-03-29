import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PayLinkService } from './paylink.service';
import { PayLinkStatus } from './entities/pay-link.entity';

describe('PayLinkService (sandbox)', () => {
  const payLinkRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const userRepo = { findOne: jest.fn() };
  const merchantRepo = { findOne: jest.fn() };
  const transactionRepo = { create: jest.fn(), save: jest.fn() };
  const sorobanService = {
    createPayLink: jest.fn(),
    payPayLink: jest.fn(),
    cancelPayLink: jest.fn(),
  };
  const gateway = { emitToUser: jest.fn() };
  const emailService = { queue: jest.fn() };
  const notificationService = { create: jest.fn() };
  const balanceService = { invalidateCache: jest.fn() };
  const feesService = { computeFee: jest.fn(), recordFee: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();

    payLinkRepo.create.mockImplementation((x: any) => x);
    payLinkRepo.save.mockImplementation(async (x: any) => x);
    payLinkRepo.findOne.mockResolvedValue(null);
  });

  it('sandbox create does not call Soroban and stores sandbox=true', async () => {
    const service = new PayLinkService(
      payLinkRepo as any,
      userRepo as any,
      merchantRepo as any,
      transactionRepo as any,
      sorobanService as any,
      gateway as any,
      emailService as any,
      notificationService as any,
      balanceService as any,
      feesService as any,
    );

    const creator = { id: 'u1', username: 'merchant' } as any;
    const result = await service.create(
      creator,
      { amount: '25.00', note: 'sandbox link' } as any,
      { sandbox: true },
    );

    expect(sorobanService.createPayLink).not.toHaveBeenCalled();
    expect(result.sandbox).toBe(true);
    expect(result.status).toBe(PayLinkStatus.ACTIVE);
    expect(result.createdTxHash).toMatch(/^sandbox_/);
  });
});
