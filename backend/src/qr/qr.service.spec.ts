import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getRedisToken } from '@nestjs-modules/ioredis';
import { BadRequestException } from '@nestjs/common';
import { QrService } from './qr.service';
import { PayLink, PayLinkStatus } from '../paylink/entities/pay-link.entity';

// Mock the qrcode library at module level
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

import * as QRCode from 'qrcode';

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockPayLinkRepo = {
  findOne: jest.fn(),
};

describe('QrService', () => {
  let service: QrService;
  const mockedToDataURL = QRCode.toDataURL as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrService,
        { provide: getRedisToken(), useValue: mockRedis },
        { provide: getRepositoryToken(PayLink), useValue: mockPayLinkRepo },
      ],
    }).compile();

    service = module.get<QrService>(QrService);
  });

  describe('generateUserQr', () => {
    it('returns a base64 data URL string on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockedToDataURL.mockResolvedValue('data:image/png;base64,abc123');

      const result = await service.generateUserQr('alice', '10', 'coffee');

      expect(result.qrDataUrl).toBe('data:image/png;base64,abc123');
      expect(result.paymentUrl).toContain('cheesewallet://pay');
      expect(result.paymentUrl).toContain('to=alice');
      expect(result.paymentUrl).toContain('amount=10');
      expect(result.paymentUrl).toContain('note=coffee');
      expect(mockedToDataURL).toHaveBeenCalledWith(
        expect.stringContaining('cheesewallet://pay'),
        expect.objectContaining({ errorCorrectionLevel: 'M', width: 300 }),
      );
    });

    it('returns cached value and skips QRCode library on cache hit', async () => {
      const cachedDataUrl = 'data:image/png;base64,cached123';
      mockRedis.get.mockResolvedValue(cachedDataUrl);

      const result = await service.generateUserQr('alice');

      expect(result.qrDataUrl).toBe(cachedDataUrl);
      expect(mockedToDataURL).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('builds paymentUrl without optional params when not provided', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockedToDataURL.mockResolvedValue('data:image/png;base64,xyz');

      const result = await service.generateUserQr('bob');

      expect(result.paymentUrl).toBe('cheesewallet://pay?to=bob');
    });

    it('caches the generated QR with TTL 3600', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockedToDataURL.mockResolvedValue('data:image/png;base64,xyz');

      await service.generateUserQr('alice');

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^qr:/),
        expect.stringContaining('data:image/png;base64,'),
        'EX',
        3600,
      );
    });
  });

  describe('generatePayLinkQr', () => {
    it('throws BadRequestException when PayLink does not exist', async () => {
      mockPayLinkRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generatePayLinkQr('nonexistent-token'),
      ).rejects.toThrow(BadRequestException);
      expect(mockedToDataURL).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when PayLink is inactive', async () => {
      mockPayLinkRepo.findOne.mockResolvedValue({
        tokenId: 'token-123',
        status: PayLinkStatus.INACTIVE,
      });

      await expect(service.generatePayLinkQr('token-123')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockedToDataURL).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when PayLink is expired', async () => {
      mockPayLinkRepo.findOne.mockResolvedValue({
        tokenId: 'token-456',
        status: PayLinkStatus.EXPIRED,
      });

      await expect(service.generatePayLinkQr('token-456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns QR for an active PayLink', async () => {
      mockPayLinkRepo.findOne.mockResolvedValue({
        tokenId: 'active-token',
        status: PayLinkStatus.ACTIVE,
      });
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockedToDataURL.mockResolvedValue('data:image/png;base64,paylink123');

      const result = await service.generatePayLinkQr('active-token');

      expect(result.qrDataUrl).toBe('data:image/png;base64,paylink123');
      expect(result.paymentUrl).toBe('cheesewallet://paylink?id=active-token');
    });

    it('returns cached value and skips QRCode library on cache hit for PayLink', async () => {
      mockPayLinkRepo.findOne.mockResolvedValue({
        tokenId: 'cached-token',
        status: PayLinkStatus.ACTIVE,
      });
      mockRedis.get.mockResolvedValue('data:image/png;base64,cached-paylink');

      const result = await service.generatePayLinkQr('cached-token');

      expect(result.qrDataUrl).toBe('data:image/png;base64,cached-paylink');
      expect(mockedToDataURL).not.toHaveBeenCalled();
    });
  });

  describe('buildWebFallbackUrl', () => {
    it('builds the correct web fallback URL', () => {
      const url = service.buildWebFallbackUrl('alice');
      expect(url).toBe('https://pay.cheesewallet.app/alice');
    });

    it('encodes special characters in username', () => {
      const url = service.buildWebFallbackUrl('alice+bob');
      expect(url).toBe('https://pay.cheesewallet.app/alice%2Bbob');
    });
  });
});
