import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReceiptService } from './receipt.service';
import { Transaction, TransactionStatus, TransactionType } from '../transactions/entities/transaction.entity';
import { PayLink, PayLinkStatus } from '../paylink/entities/pay-link.entity';
import { User } from '../users/entities/user.entity';
import { Merchant } from '../merchants/entities/merchant.entity';
import { EmailService } from '../email/email.service';
import { r2Config } from '../config/r2.config';

// ── S3 mock ──────────────────────────────────────────────────────────────────
const mockS3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  HeadObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://r2.example.com/receipt.pdf?sig=abc'),
}));

const mockR2Config = {
  accountId: 'acc',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  bucketName: 'bucket',
};

const baseTx = (): Transaction =>
  ({
    id: 'tx-uuid-1234',
    userId: 'user-1',
    type: TransactionType.TRANSFER_OUT,
    amountUsdc: '10.000000',
    amount: 10,
    fee: '0.05',
    balanceAfter: '90',
    status: TransactionStatus.COMPLETED,
    reference: 'ABCDEF12',
    counterpartyUsername: 'alice',
    createdAt: new Date('2025-01-01T12:00:00Z'),
    metadata: {},
  } as any);

const basePl = (): PayLink =>
  ({
    id: 'pl-uuid',
    tokenId: 'TOKEN123',
    creatorUserId: 'user-1',
    paidByUserId: 'user-2',
    amount: '5.000000',
    note: 'For coffee',
    status: PayLinkStatus.PAID,
    paymentTxHash: 'HASH1234',
    createdAt: new Date('2025-01-01T12:00:00Z'),
    updatedAt: new Date('2025-01-01T12:05:00Z'),
  } as any);

describe('ReceiptService', () => {
  let service: ReceiptService;
  let txRepo: any;
  let plRepo: any;
  let userRepo: any;
  let merchantRepo: any;
  let emailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptService,
        { provide: getRepositoryToken(Transaction), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(PayLink), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Merchant), useValue: { findOne: jest.fn() } },
        { provide: r2Config.KEY, useValue: mockR2Config },
        { provide: EmailService, useValue: { queue: jest.fn() } },
      ],
    }).compile();

    service = module.get(ReceiptService);
    txRepo = module.get(getRepositoryToken(Transaction));
    plRepo = module.get(getRepositoryToken(PayLink));
    userRepo = module.get(getRepositoryToken(User));
    merchantRepo = module.get(getRepositoryToken(Merchant));
    emailService = module.get(EmailService);

    mockS3Send.mockReset();
    jest.clearAllMocks();
  });

  describe('generateTransactionReceipt', () => {
    it('generates receipt for own transaction and returns presigned URL', async () => {
      txRepo.findOne.mockResolvedValue(baseTx());
      // HeadObject throws (not cached), PutObject succeeds
      mockS3Send.mockRejectedValueOnce(new Error('NoSuchKey')).mockResolvedValue({});

      const result = await service.generateTransactionReceipt('tx-uuid-1234', 'user-1');

      expect(result.receiptUrl).toContain('https://r2.example.com');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('throws 403 for another user\'s transaction', async () => {
      txRepo.findOne.mockResolvedValue(baseTx()); // userId = 'user-1'

      await expect(
        service.generateTransactionReceipt('tx-uuid-1234', 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when transaction not found', async () => {
      txRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateTransactionReceipt('missing', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns cached receipt without regenerating when already in R2', async () => {
      txRepo.findOne.mockResolvedValue(baseTx());
      // HeadObject succeeds → cached
      mockS3Send.mockResolvedValue({});

      await service.generateTransactionReceipt('tx-uuid-1234', 'user-1');

      // PutObject should NOT have been called
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      expect(PutObjectCommand).not.toHaveBeenCalled();
    });

    it('regenerates when forceRefresh=true even if cached', async () => {
      txRepo.findOne.mockResolvedValue(baseTx());
      mockS3Send.mockResolvedValue({});

      await service.generateTransactionReceipt('tx-uuid-1234', 'user-1', true);

      // PutObject should have been called
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalled();
    });
  });

  describe('generatePayLinkReceipt', () => {
    it('generates receipt for creator', async () => {
      plRepo.findOne.mockResolvedValue(basePl());
      userRepo.findOne.mockResolvedValue({ username: 'creator', displayName: 'Creator' });
      merchantRepo.findOne.mockResolvedValue(null);
      mockS3Send.mockRejectedValueOnce(new Error('NoSuchKey')).mockResolvedValue({});

      const result = await service.generatePayLinkReceipt('TOKEN123', 'user-1');
      expect(result.receiptUrl).toBeTruthy();
    });

    it('generates receipt for payer', async () => {
      plRepo.findOne.mockResolvedValue(basePl());
      userRepo.findOne.mockResolvedValue({ username: 'creator' });
      merchantRepo.findOne.mockResolvedValue(null);
      mockS3Send.mockRejectedValueOnce(new Error('NoSuchKey')).mockResolvedValue({});

      const result = await service.generatePayLinkReceipt('TOKEN123', 'user-2');
      expect(result.receiptUrl).toBeTruthy();
    });

    it('throws 403 for unrelated user', async () => {
      plRepo.findOne.mockResolvedValue(basePl());

      await expect(
        service.generatePayLinkReceipt('TOKEN123', 'user-99'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('emailTransactionReceipt', () => {
    it('queues email with receipt URL', async () => {
      txRepo.findOne.mockResolvedValue(baseTx());
      userRepo.findOne.mockResolvedValue({ id: 'user-1', email: 'user@example.com', username: 'user1', displayName: 'User One' });
      mockS3Send.mockRejectedValueOnce(new Error('NoSuchKey')).mockResolvedValue({});

      await service.emailTransactionReceipt('tx-uuid-1234', 'user-1');

      expect(emailService.queue).toHaveBeenCalledWith(
        'user@example.com',
        'transaction-receipt',
        expect.objectContaining({ receiptUrl: expect.any(String) }),
        'user-1',
      );
    });
  });
});
