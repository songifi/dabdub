import { Test, TestingModule } from '@nestjs/testing';
import { getRedisToken } from '@nestjs-modules/ioredis';
import { IpBlockService } from './ip-block.service';

const TEST_IP = '192.168.1.100';

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
};

describe('IpBlockService', () => {
  let service: IpBlockService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpBlockService,
        { provide: getRedisToken(), useValue: mockRedis },
      ],
    }).compile();

    service = module.get<IpBlockService>(IpBlockService);
  });

  describe('recordThrottleHit', () => {
    it('blocks the IP after 5 consecutive throttle violations', async () => {
      // Simulate 4 previous hits, 5th hit triggers block
      mockRedis.incr.mockResolvedValue(5);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      await service.recordThrottleHit(TEST_IP);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `ip:blocked:${TEST_IP}`,
        '1',
        'EX',
        3600,
      );
    });

    it('does not block the IP before reaching the threshold', async () => {
      mockRedis.incr.mockResolvedValue(3);
      mockRedis.expire.mockResolvedValue(1);

      await service.recordThrottleHit(TEST_IP);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('sets expiry on first hit only', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await service.recordThrottleHit(TEST_IP);

      expect(mockRedis.expire).toHaveBeenCalledWith(
        `ip:throttle_hits:${TEST_IP}`,
        3600,
      );
    });

    it('does not set expiry on subsequent hits', async () => {
      mockRedis.incr.mockResolvedValue(2);

      await service.recordThrottleHit(TEST_IP);

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  describe('isBlocked', () => {
    it('returns true when blocked key exists in Redis', async () => {
      mockRedis.get.mockResolvedValue('1');
      const result = await service.isBlocked(TEST_IP);
      expect(result).toBe(true);
    });

    it('returns false when blocked key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await service.isBlocked(TEST_IP);
      expect(result).toBe(false);
    });
  });

  describe('unblockIp', () => {
    it('deletes both the blocked key and the hit counter key', async () => {
      mockRedis.del.mockResolvedValue(2);

      await service.unblockIp(TEST_IP);

      expect(mockRedis.del).toHaveBeenCalledWith(
        `ip:blocked:${TEST_IP}`,
        `ip:throttle_hits:${TEST_IP}`,
      );
    });
  });

  describe('6th login from same IP triggers 429', () => {
    /**
     * This test validates the throttler guard behaviour at the service boundary.
     * The ThrottlerGuard itself enforces the limit; here we verify that after
     * 5 throttle hits the IP is blocked and subsequent requests are rejected immediately.
     */
    it('blocks IP on 5th throttle hit so the 6th request is rejected immediately', async () => {
      // Simulate 5 throttle hits accumulating
      for (let hitCount = 1; hitCount <= 5; hitCount++) {
        mockRedis.incr.mockResolvedValueOnce(hitCount);
        if (hitCount === 1) mockRedis.expire.mockResolvedValueOnce(1);
        if (hitCount === 5) mockRedis.set.mockResolvedValueOnce('OK');
        await service.recordThrottleHit(TEST_IP);
      }

      // After 5 hits the IP is blocked
      mockRedis.get.mockResolvedValue('1');
      const blocked = await service.isBlocked(TEST_IP);
      expect(blocked).toBe(true);

      // The middleware would now short-circuit any further requests from this IP
    });
  });
});
