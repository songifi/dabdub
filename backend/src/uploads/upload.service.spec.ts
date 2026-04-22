import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { FileUpload, UploadPurpose } from './entities/file-upload.entity';
import { r2Config } from '../config/r2.config';

// Mock the presigner so no real HTTP calls are made
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://r2.example.com/presigned'),
}));

// Mock S3Client send — default success; individual tests override for HeadObject
const mockSend = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  };
});

const mockRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((v: Partial<FileUpload>) => v as FileUpload),
  delete: jest.fn(),
};

const mockR2Config = {
  accountId: 'test-account',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  bucketName: 'test-bucket',
};

describe('UploadService', () => {
  let service: UploadService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.save.mockImplementation((v: FileUpload) => Promise.resolve(v));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: getRepositoryToken(FileUpload), useValue: mockRepo },
        { provide: r2Config.KEY, useValue: mockR2Config },
      ],
    }).compile();

    service = module.get(UploadService);
  });

  describe('getPresignedUrl', () => {
    it('throws 400 when mimeType is not in whitelist', async () => {
      await expect(
        service.getPresignedUrl('user-1', {
          purpose: UploadPurpose.KYC,
          mimeType: 'video/mp4',
          sizeBytes: 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when sizeBytes exceeds 10 MB', async () => {
      await expect(
        service.getPresignedUrl('user-1', {
          purpose: UploadPurpose.KYC,
          mimeType: 'image/jpeg',
          sizeBytes: 11 * 1024 * 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns a presigned url and key for valid input', async () => {
      const result = await service.getPresignedUrl('user-1', {
        purpose: UploadPurpose.KYC,
        mimeType: 'image/jpeg',
        sizeBytes: 500_000,
      });

      expect(result.url).toBe('https://r2.example.com/presigned');
      expect(result.key).toMatch(/^kyc\/user-1\/.+\.jpeg$/);
    });
  });

  describe('confirmUpload', () => {
    it('throws 404 when record does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.confirmUpload('user-1', 'kyc/user-1/missing.jpeg')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 400 when file is not found in R2 (HeadObject fails)', async () => {
      mockRepo.findOne.mockResolvedValue({
        key: 'kyc/user-1/file.jpeg',
        userId: 'user-1',
        isConfirmed: false,
      } as FileUpload);
      mockSend.mockRejectedValueOnce(new Error('NotFound'));

      await expect(service.confirmUpload('user-1', 'kyc/user-1/file.jpeg')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws 403 when a different user tries to confirm', async () => {
      mockRepo.findOne.mockResolvedValue({
        key: 'kyc/user-1/file.jpeg',
        userId: 'user-1',
        isConfirmed: false,
      } as FileUpload);

      await expect(service.confirmUpload('user-2', 'kyc/user-1/file.jpeg')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('sets isConfirmed=true on success', async () => {
      const record = {
        key: 'kyc/user-1/file.jpeg',
        userId: 'user-1',
        isConfirmed: false,
      } as FileUpload;
      mockRepo.findOne.mockResolvedValue(record);
      mockSend.mockResolvedValueOnce({});

      const result = await service.confirmUpload('user-1', 'kyc/user-1/file.jpeg');
      expect(result.isConfirmed).toBe(true);
    });
  });
});
