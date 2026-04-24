import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('incrementPaymentCreated', () => {
    it('should increment payment_created_total counter', () => {
      const spy = jest.spyOn(service.paymentCreatedTotal, 'inc');
      service.incrementPaymentCreated('deposit');
      expect(spy).toHaveBeenCalledWith({ type: 'deposit' });
    });

    it('should support paylink type', () => {
      const spy = jest.spyOn(service.paymentCreatedTotal, 'inc');
      service.incrementPaymentCreated('paylink');
      expect(spy).toHaveBeenCalledWith({ type: 'paylink' });
    });

    it('should support withdrawal type', () => {
      const spy = jest.spyOn(service.paymentCreatedTotal, 'inc');
      service.incrementPaymentCreated('withdrawal');
      expect(spy).toHaveBeenCalledWith({ type: 'withdrawal' });
    });
  });

  describe('incrementPaymentSettled', () => {
    it('should increment payment_settled_total counter', () => {
      const spy = jest.spyOn(service.paymentSettledTotal, 'inc');
      service.incrementPaymentSettled('withdrawal');
      expect(spy).toHaveBeenCalledWith({ type: 'withdrawal' });
    });
  });

  describe('incrementSettlementFailed', () => {
    it('should increment settlement_failed_total counter', () => {
      const spy = jest.spyOn(service.settlementFailedTotal, 'inc');
      service.incrementSettlementFailed('withdrawal');
      expect(spy).toHaveBeenCalledWith({ type: 'withdrawal' });
    });
  });

  describe('observeSettlementDuration', () => {
    it('should observe settlement_duration_seconds histogram', () => {
      const spy = jest.spyOn(service.settlementDurationSeconds, 'observe');
      service.observeSettlementDuration('withdrawal', 1.5);
      expect(spy).toHaveBeenCalledWith({ type: 'withdrawal' }, 1.5);
    });
  });
});

