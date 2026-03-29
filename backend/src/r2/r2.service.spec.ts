import { Test, TestingModule } from '@nestjs/testing';
import { R2Service } from './r2.service';
import { r2Config } from '../config/r2.config';

const mockSend = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

const cfg = {
  accountId: 'acct',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  bucketName: 'bucket',
  publicDomain: 'https://pub.example.com',
};

describe('R2Service', () => {
  let service: R2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        R2Service,
        { provide: r2Config.KEY, useValue: cfg },
      ],
    }).compile();

    service = module.get<R2Service>(R2Service);
    jest.clearAllMocks();
  });

  it('getPresignedUploadUrl returns uploadUrl and key', async () => {
    mockGetSignedUrl.mockResolvedValue('https://signed.url/upload');
    const result = await service.getPresignedUploadUrl('kyc/user/file.jpg', 'image/jpeg');
    expect(result.uploadUrl).toBe('https://signed.url/upload');
    expect(result.key).toBe('kyc/user/file.jpg');
  });

  it('getPresignedDownloadUrl returns signed url', async () => {
    mockGetSignedUrl.mockResolvedValue('https://signed.url/download');
    const url = await service.getPresignedDownloadUrl('kyc/user/file.jpg');
    expect(url).toBe('https://signed.url/download');
  });

  it('headObject returns exists=true with metadata on success', async () => {
    mockSend.mockResolvedValue({ ContentType: 'image/jpeg', ContentLength: 1024 });
    const result = await service.headObject('kyc/user/file.jpg');
    expect(result.exists).toBe(true);
    expect(result.contentType).toBe('image/jpeg');
    expect(result.contentLength).toBe(1024);
  });

  it('headObject returns exists=false on 404', async () => {
    mockSend.mockRejectedValue(new Error('NotFound'));
    const result = await service.headObject('kyc/user/missing.jpg');
    expect(result.exists).toBe(false);
  });

  it('deleteObject calls send with DeleteObjectCommand', async () => {
    mockSend.mockResolvedValue({});
    await service.deleteObject('reports/job/file.csv');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('getPublicUrl uses R2_PUBLIC_DOMAIN', () => {
    expect(service.getPublicUrl('logos/merchant/logo.png')).toBe(
      'https://pub.example.com/logos/merchant/logo.png',
    );
  });
});
