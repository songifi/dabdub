import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { KycService } from './kyc.service';
import { KycSubmission, KycSubmissionStatus, KycDocumentType } from './entities/kyc-submission.entity';
import { User, KycStatus } from '../users/entities/user.entity';
import { TierName } from '../tier-config/entities/tier-config.entity';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notifications/notifications.service';
import { r2Config } from '../config/r2.config';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockKycRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockUserRepo = {
  findOne: jest.fn(),
  update: jest.fn(),
};

const mockEmail = { queue: jest.fn().mockResolvedValue({}) };
const mockNotification = { create: jest.fn().mockResolvedValue({}) };

const mockR2Config = {
  accountId: 'test-account',
  accessKeyId: 'test-key',
  secretAccessKey: 'test-secret',
  bucketName: 'test-bucket',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeSubmission = (overrides: Partial<KycSubmission> = {}): KycSubmission =>
  ({
    id: 'kyc-uuid-1',
    userId: 'user-uuid-1',
    targetTier: TierName.GOLD,
    status: KycSubmissionStatus.PENDING,
    bvnLast4: '1234',
    ninLast4: '5678',
    documentType: KycDocumentType.ID,
    documentFrontKey: 'kyc/user-uuid-1/front.jpg',
    documentBackKey: null,
    selfieKey: 'kyc/user-uuid-1/selfie.jpg',
    reviewNote: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as KycSubmission);

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid-1',
    email: 'alice@example.com',
    tier: TierName.SILVER,
    kycStatus: KycStatus.NONE,
    ...overrides,
  } as User);

const submitDto = {
  targetTier: TierName.GOLD as TierName.GOLD,
  bvnLast4: '1234',
  ninLast4: '5678',
  documentType: KycDocumentType.ID,
  documentFrontKey: 'kyc/user-uuid-1/front.jpg',
  selfieKey: 'kyc/user-uuid-1/selfie.jpg',
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('KycService', () => {
  let service: KycService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: getRepositoryToken(KycSubmission), useValue: mockKycRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: r2Config.KEY, useValue: mockR2Config },
        { provide: EmailService, useValue: mockEmail },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
  });

  // ── submit ────────────────────────────────────────────────────────────────

  describe('submit', () => {
    it('creates submission in pending status and awards base state', async () => {
      mockKycRepo.findOne.mockResolvedValue(null); // no active submission
      const saved = makeSubmission();
      mockKycRepo.create.mockReturnValue(saved);
      mockKycRepo.save.mockResolvedValue(saved);
      mockUserRepo.update.mockResolvedValue(undefined);

      const result = await service.submit('user-uuid-1', submitDto);

      expect(mockKycRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: KycSubmissionStatus.PENDING }),
      );
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-uuid-1', {
        kycStatus: KycStatus.PENDING,
      });
      expect(result.status).toBe(KycSubmissionStatus.PENDING);
    });

    it('throws 409 when user already has an active submission', async () => {
      mockKycRepo.findOne.mockResolvedValue(makeSubmission()); // active exists

      await expect(service.submit('user-uuid-1', submitDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockKycRepo.save).not.toHaveBeenCalled();
    });

    it('notifies admin via email on new submission', async () => {
      mockKycRepo.findOne.mockResolvedValue(null);
      const saved = makeSubmission();
      mockKycRepo.create.mockReturnValue(saved);
      mockKycRepo.save.mockResolvedValue(saved);
      mockUserRepo.update.mockResolvedValue(undefined);

      await service.submit('user-uuid-1', submitDto);

      // Allow fire-and-forget to settle
      await new Promise(process.nextTick);
      expect(mockEmail.queue).toHaveBeenCalledWith(
        'admin@system.local',
        'kyc-new-submission',
        expect.objectContaining({ userId: 'user-uuid-1' }),
      );
    });
  });

  // ── approve ───────────────────────────────────────────────────────────────

  describe('approve', () => {
    it('sets approved, upgrades user tier, sends WS + email', async () => {
      const submission = makeSubmission({ status: KycSubmissionStatus.PENDING });
      mockKycRepo.findOne.mockResolvedValue(submission);
      mockKycRepo.save.mockResolvedValue({ ...submission, status: KycSubmissionStatus.APPROVED });
      mockUserRepo.update.mockResolvedValue(undefined);
      mockUserRepo.findOne.mockResolvedValue(makeUser());

      const result = await service.approve('kyc-uuid-1', 'admin-uuid');

      expect(mockUserRepo.update).toHaveBeenCalledWith('user-uuid-1', {
        tier: TierName.GOLD,
        kycStatus: KycStatus.APPROVED,
      });
      expect(mockNotification.create).toHaveBeenCalledWith(
        'user-uuid-1',
        'tier_upgraded',
        'KYC Approved',
        expect.stringContaining('Gold'),
        expect.any(Object),
      );
      await new Promise(process.nextTick);
      expect(mockEmail.queue).toHaveBeenCalledWith(
        'alice@example.com', 'kyc-approved', expect.any(Object),
      );
      expect(result.status).toBe(KycSubmissionStatus.APPROVED);
    });

    it('throws 404 for unknown submission id', async () => {
      mockKycRepo.findOne.mockResolvedValue(null);

      await expect(service.approve('bad-id', 'admin-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── reject ────────────────────────────────────────────────────────────────

  describe('reject', () => {
    it('sets rejected, sends email with review note', async () => {
      const submission = makeSubmission({ status: KycSubmissionStatus.PENDING });
      mockKycRepo.findOne.mockResolvedValue(submission);
      mockKycRepo.save.mockResolvedValue({ ...submission, status: KycSubmissionStatus.REJECTED });
      mockUserRepo.update.mockResolvedValue(undefined);
      mockUserRepo.findOne.mockResolvedValue(makeUser());

      await service.reject('kyc-uuid-1', 'admin-uuid', { reviewNote: 'Blurry document' });

      expect(mockNotification.create).toHaveBeenCalledWith(
        'user-uuid-1',
        'kyc_update',
        'KYC Rejected',
        expect.stringContaining('Blurry document'),
        expect.any(Object),
      );
      await new Promise(process.nextTick);
      expect(mockEmail.queue).toHaveBeenCalledWith(
        'alice@example.com',
        'kyc-rejected',
        expect.objectContaining({ reviewNote: 'Blurry document' }),
      );
    });
  });

  // ── requestInfo ───────────────────────────────────────────────────────────

  describe('requestInfo', () => {
    it('sets status to under_review and notifies user', async () => {
      const submission = makeSubmission({ status: KycSubmissionStatus.PENDING });
      mockKycRepo.findOne.mockResolvedValue(submission);
      mockKycRepo.save.mockResolvedValue({ ...submission, status: KycSubmissionStatus.UNDER_REVIEW });
      mockUserRepo.update.mockResolvedValue(undefined);

      const result = await service.requestInfo('kyc-uuid-1', 'admin-uuid');

      expect(mockNotification.create).toHaveBeenCalledWith(
        'user-uuid-1',
        'kyc_update',
        'Additional Info Required',
        expect.any(String),
        expect.any(Object),
      );
      expect(result.status).toBe(KycSubmissionStatus.UNDER_REVIEW);
    });
  });
});
