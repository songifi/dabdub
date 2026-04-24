jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { IdempotencyInterceptor } from '../payment/idempotency.interceptor';
import { CacheService } from '../cache/cache.service';
import { PaymentStatus } from './entities/payment.entity';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            getStats: jest.fn(),
            refund: jest.fn(),
          },
        },
        IdempotencyInterceptor,
        {
          provide: CacheService,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('refund', () => {
    it('should call service.refund', async () => {
      const dto = { reason: 'Test refund', amountUsd: 50 };
      const req = { user: { merchantId: 'm1' } };
      const paymentId = 'p1';

      jest.spyOn(service, 'refund').mockResolvedValue({ id: paymentId, status: PaymentStatus.REFUNDED } as any);

      const result = await controller.refund(req as any, paymentId, dto);

      expect(service.refund).toHaveBeenCalledWith(paymentId, 'm1', dto);
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });
  });
});
