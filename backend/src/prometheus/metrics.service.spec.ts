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

  describe('recordHttpRequest', () => {
    it('should increment http_requests_total counter with correct labels', () => {
      const spy = jest.spyOn(service.httpRequestsTotal, 'inc');
      service.recordHttpRequest('GET', '/api/v1/users', 200, 150);
      expect(spy).toHaveBeenCalledWith({
        method: 'GET',
        route: '/api/v1/users',
        status: '200',
      });
    });

    it('should observe http_request_duration_ms histogram with correct labels', () => {
      const spy = jest.spyOn(service.httpRequestDurationMs, 'observe');
      service.recordHttpRequest('POST', '/api/v1/payments', 201, 350);
      expect(spy).toHaveBeenCalledWith(
        { method: 'POST', route: '/api/v1/payments', status: '201' },
        350,
      );
    });

    it('should handle error status codes', () => {
      const counterSpy = jest.spyOn(service.httpRequestsTotal, 'inc');
      const histogramSpy = jest.spyOn(service.httpRequestDurationMs, 'observe');

      service.recordHttpRequest('DELETE', '/api/v1/items/:id', 404, 80);

      expect(counterSpy).toHaveBeenCalledWith({
        method: 'DELETE',
        route: '/api/v1/items/:id',
        status: '404',
      });
      expect(histogramSpy).toHaveBeenCalledWith(
        { method: 'DELETE', route: '/api/v1/items/:id', status: '404' },
        80,
      );
    });

    it('should convert numeric status to string', () => {
      const counterSpy = jest.spyOn(service.httpRequestsTotal, 'inc');
      service.recordHttpRequest('PATCH', '/api/v1/config', 500, 1200);
      expect(counterSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: '500' }),
      );
    });
  });

  describe('recordCacheLookup', () => {
    it('should increment cache_requests_total for hit result', () => {
      const spy = jest.spyOn(service.cacheRequestsTotal, 'inc');
      service.recordCacheLookup('exchange-rate', 'hit');
      expect(spy).toHaveBeenCalledWith({ key_pattern: 'exchange-rate', result: 'hit' });
    });

    it('should increment cache_requests_total for miss result', () => {
      const spy = jest.spyOn(service.cacheRequestsTotal, 'inc');
      service.recordCacheLookup('exchange-rate', 'miss');
      expect(spy).toHaveBeenCalledWith({ key_pattern: 'exchange-rate', result: 'miss' });
    });
  });
});

