import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SlippageService, SLIPPAGE_EXCEEDED_EVENT } from './slippage.service';
import { SlippageConfig } from './entities/slippage-config.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((v) => v),
});

describe('SlippageService', () => {
  let service: SlippageService;
  let repo: ReturnType<typeof mockRepo>;
  let emitter: { emit: jest.Mock };

  beforeEach(async () => {
    repo = mockRepo();
    emitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlippageService,
        { provide: getRepositoryToken(SlippageConfig), useValue: repo },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();

    service = module.get(SlippageService);
  });

  const withMaxBps = (bps: number) => {
    repo.findOne.mockResolvedValue({ key: 'global', maxSlippageBps: bps });
  };

  describe('checkSlippage', () => {
    it('passes when slippage is exactly at the boundary (100 bps)', async () => {
      withMaxBps(100);
      // expected=1.0000, actual=0.9900 → slippage = 0.01/1.0 * 10000 = 100 bps
      await expect(service.checkSlippage('1.0000', '0.9900')).resolves.toBeUndefined();
      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it('rejects when slippage is one bps over the boundary (101 bps)', async () => {
      withMaxBps(100);
      // expected=10000, actual=9899 → slippage = 101/10000 * 10000 = 101 bps
      await expect(service.checkSlippage('10000', '9899')).rejects.toThrow(ForbiddenException);
      expect(emitter.emit).toHaveBeenCalledWith(
        SLIPPAGE_EXCEEDED_EVENT,
        expect.objectContaining({ actualSlippageBps: 101, maxSlippageBps: 100 }),
      );
    });

    it('passes when actual rate is better than expected (negative slippage)', async () => {
      withMaxBps(100);
      // actual > expected — slippage is 0 bps
      await expect(service.checkSlippage('1.0000', '1.0100')).resolves.toBeUndefined();
    });

    it('throws BadRequestException for zero expectedRate', async () => {
      withMaxBps(100);
      await expect(service.checkSlippage('0', '1.0')).rejects.toThrow(BadRequestException);
    });

    it('emits SlippageExceeded event with expected vs actual', async () => {
      withMaxBps(50);
      await expect(service.checkSlippage('100', '99')).rejects.toThrow(ForbiddenException);
      expect(emitter.emit).toHaveBeenCalledWith(
        SLIPPAGE_EXCEEDED_EVENT,
        expect.objectContaining({
          expectedRate: '100',
          actualRate: '99',
          maxSlippageBps: 50,
          actualSlippageBps: 100,
        }),
      );
    });
  });

  describe('setMaxSlippage', () => {
    it('updates existing row', async () => {
      const row = { key: 'global', maxSlippageBps: 100 };
      repo.findOne.mockResolvedValue(row);
      await service.setMaxSlippage(200);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ maxSlippageBps: 200 }));
    });

    it('creates row if not present', async () => {
      repo.findOne.mockResolvedValue(null);
      await service.setMaxSlippage(50);
      expect(repo.save).toHaveBeenCalled();
    });

    it('rejects bps > 10000', async () => {
      await expect(service.setMaxSlippage(10_001)).rejects.toThrow(BadRequestException);
    });

    it('rejects negative bps', async () => {
      await expect(service.setMaxSlippage(-1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMaxSlippageBps', () => {
    it('returns stored value', async () => {
      withMaxBps(250);
      await expect(service.getMaxSlippageBps()).resolves.toBe(250);
    });

    it('falls back to 100 when row is missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getMaxSlippageBps()).resolves.toBe(100);
    });
  });
});
