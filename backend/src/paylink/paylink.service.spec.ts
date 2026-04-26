import { PayLinkService } from './paylink.service';
import { PayLinkStatus } from './entities/pay-link.entity';

describe('PayLinkService (sandbox)', () => {
  let payLinkRepo: any;
  let userRepo: any;
  let merchantRepo: any;
  let transactionRepo: any;
  let sorobanService: any;
  let gateway: any;
  let emailService: any;
  let notificationService: any;
  let balanceService: any;
  let settlementService: any;
  let service: PayLinkService;

  beforeEach(() => {
    payLinkRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((x: any) => x),
      save: jest.fn().mockImplementation(async (x: any) => x),
      createQueryBuilder: jest.fn(),
    };

    userRepo = { findOne: jest.fn() };
    merchantRepo = { findOne: jest.fn() };
    transactionRepo = { create: jest.fn(), save: jest.fn() };
    sorobanService = {
      createPayLink: jest.fn(),
      payPayLink: jest.fn(),
      cancelPayLink: jest.fn(),
    };
    gateway = { emitToUser: jest.fn() };
    emailService = { queue: jest.fn() };
    notificationService = { create: jest.fn() };
    balanceService = { invalidateCache: jest.fn() };
    settlementService = { enqueueSettlement: jest.fn() };

    service = new PayLinkService(
      payLinkRepo as any,
      userRepo as any,
      merchantRepo as any,
      transactionRepo as any,
      sorobanService as any,
      gateway as any,
      emailService as any,
      notificationService as any,
      balanceService as any,
      settlementService as any,
    );
  });

  it('sandbox create does not call Soroban and stores sandbox=true', async () => {
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
