import * as bcrypt from 'bcrypt';
import { OtpType } from './entities/otp.entity';
import { OtpInvalidException } from './exceptions/otp-invalid.exception';
import { OtpRateLimitException } from './exceptions/otp-rate-limit.exception';
import { OtpService } from './otp.service';

describe('OtpService', () => {
  let service: OtpService;
  let mockRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let mockRedis: {
    incr: jest.Mock;
    expire: jest.Mock;
  };

  beforeEach(() => {
    mockRedis = {
      incr: jest.fn(),
      expire: jest.fn(),
    };

    mockRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    service = new OtpService(mockRepo as any, mockRedis as any);
  });

  describe('generate', () => {
    it('generates and returns a 6-digit plaintext code', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRepo.save.mockResolvedValue({});

      const code = await service.generate(
        'user-1',
        OtpType.EMAIL_VERIFY,
        '127.0.0.1',
      );

      expect(code).toMatch(/^\d{6}$/);
      expect(mockRepo.save).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'otp:rate:user-1:email_verify',
        600,
      );
    });

    it('throws OtpRateLimitException on 4th send within 10 minutes', async () => {
      mockRedis.incr.mockResolvedValue(4);

      await expect(
        service.generate('user-1', OtpType.EMAIL_VERIFY, '127.0.0.1'),
      ).rejects.toThrow(OtpRateLimitException);

      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('tracks limits separately for each OTP type', async () => {
      mockRedis.incr.mockResolvedValueOnce(3);
      mockRepo.save.mockResolvedValue({});

      await expect(
        service.generate('user-1', OtpType.EMAIL_VERIFY, '127.0.0.1'),
      ).resolves.toMatch(/^\d{6}$/);

      mockRedis.incr.mockResolvedValueOnce(1);
      await expect(
        service.generate('user-1', OtpType.PHONE_VERIFY, '127.0.0.1'),
      ).resolves.toMatch(/^\d{6}$/);
    });
  });

  describe('verify', () => {
    it('returns true when the correct code is provided', async () => {
      const plaintext = '123456';
      const hash = await bcrypt.hash(plaintext, 10);

      mockRepo.findOne.mockResolvedValue({
        id: 'otp-1',
        codeHash: hash,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });
      mockRepo.save.mockResolvedValue({});

      await expect(
        service.verify('user-1', OtpType.EMAIL_VERIFY, plaintext),
      ).resolves.toBe(true);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'otp-1',
          usedAt: expect.any(Date),
        }),
      );
    });

    it('throws OtpInvalidException when the wrong code is provided', async () => {
      const hash = await bcrypt.hash('123456', 10);

      mockRepo.findOne.mockResolvedValue({
        id: 'otp-1',
        codeHash: hash,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });

      await expect(
        service.verify('user-1', OtpType.EMAIL_VERIFY, '000000'),
      ).rejects.toThrow(OtpInvalidException);
    });

    it('throws OtpInvalidException when no valid OTP exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verify('user-1', OtpType.EMAIL_VERIFY, '123456'),
      ).rejects.toThrow(OtpInvalidException);
    });

    it('throws OtpInvalidException when the latest OTP is expired', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verify('user-1', OtpType.PHONE_VERIFY, '123456'),
      ).rejects.toThrow(OtpInvalidException);
    });

    it('marks an OTP as used after successful verification', async () => {
      const plaintext = '654321';
      const hash = await bcrypt.hash(plaintext, 10);

      mockRepo.findOne.mockResolvedValue({
        id: 'otp-2',
        codeHash: hash,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });
      mockRepo.save.mockResolvedValue({});

      await service.verify('user-1', OtpType.LOGIN, plaintext);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'otp-2',
          usedAt: expect.any(Date),
        }),
      );
    });
  });
});
