import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { SplitService, SPLIT_QUEUE } from './split.service';
import { SplitRequest, SplitRequestStatus } from './entities/split-request.entity';
import { SplitParticipant, SplitParticipantStatus } from './entities/split-participant.entity';
import { UsersService } from '../users/users.service';
import { TransfersService } from '../transfers/transfers.service';
import { NotificationService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

const mockUser = (id: string, username: string) => ({
  id,
  username,
  email: `${username}@example.com`,
  displayName: username,
});

const mockSplit = (overrides = {}): SplitRequest =>
  ({
    id: 'split-1',
    initiatorId: 'user-initiator',
    title: 'Dinner',
    totalAmountUsdc: '30.000000',
    note: null,
    status: SplitRequestStatus.ACTIVE,
    expiresAt: new Date(Date.now() + 86_400_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any);

const mockParticipant = (overrides = {}): SplitParticipant =>
  ({
    id: 'part-1',
    splitRequestId: 'split-1',
    userId: 'user-alice',
    username: 'alice',
    amountOwedUsdc: '15.000000',
    status: SplitParticipantStatus.PENDING,
    paidAt: null,
    txHash: null,
    ...overrides,
  } as any);

describe('SplitService', () => {
  let service: SplitService;
  let splitRepo: any;
  let participantRepo: any;
  let usersService: jest.Mocked<UsersService>;
  let transfersService: jest.Mocked<TransfersService>;
  let notificationService: jest.Mocked<NotificationService>;
  let emailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SplitService,
        {
          provide: getRepositoryToken(SplitRequest),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn((v) => v),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
            })),
          },
        },
        {
          provide: getRepositoryToken(SplitParticipant),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn((v) => v),
            update: jest.fn(),
            count: jest.fn(),
          },
        },
        { provide: UsersService, useValue: { findByUsername: jest.fn(), findById: jest.fn() } },
        { provide: TransfersService, useValue: { create: jest.fn() } },
        { provide: NotificationService, useValue: { create: jest.fn() } },
        { provide: EmailService, useValue: { queue: jest.fn() } },
        { provide: getQueueToken(SPLIT_QUEUE), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get(SplitService);
    splitRepo = module.get(getRepositoryToken(SplitRequest));
    participantRepo = module.get(getRepositoryToken(SplitParticipant));
    usersService = module.get(UsersService);
    transfersService = module.get(TransfersService);
    notificationService = module.get(NotificationService);
    emailService = module.get(EmailService);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates split and notifies participants', async () => {
      usersService.findByUsername
        .mockResolvedValueOnce(mockUser('user-alice', 'alice') as any)
        .mockResolvedValueOnce(mockUser('user-bob', 'bob') as any);
      splitRepo.save.mockResolvedValue(mockSplit());
      participantRepo.save.mockResolvedValue([mockParticipant()]);

      await service.create('user-initiator', 'initiator', {
        title: 'Dinner',
        expiresInHours: 24,
        participants: [
          { username: 'alice', amountUsdc: '15.00' },
          { username: 'bob', amountUsdc: '15.00' },
        ],
      });

      expect(splitRepo.save).toHaveBeenCalled();
      expect(participantRepo.save).toHaveBeenCalled();
      expect(notificationService.create).toHaveBeenCalled();
    });

    it('throws if initiator is listed as participant', async () => {
      await expect(
        service.create('user-initiator', 'initiator', {
          title: 'Dinner',
          expiresInHours: 24,
          participants: [{ username: 'initiator', amountUsdc: '10.00' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown participant username', async () => {
      usersService.findByUsername.mockResolvedValue(null);

      await expect(
        service.create('user-initiator', 'initiator', {
          title: 'Dinner',
          expiresInHours: 24,
          participants: [{ username: 'ghost', amountUsdc: '10.00' }],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── pay ───────────────────────────────────────────────────────────────────

  describe('pay', () => {
    it('calls TransfersService.create and marks participant paid', async () => {
      splitRepo.findOne.mockResolvedValue(mockSplit());
      participantRepo.findOne.mockResolvedValue(mockParticipant());
      participantRepo.count.mockResolvedValue(0); // all paid after this
      usersService.findById.mockResolvedValue(mockUser('user-initiator', 'initiator') as any);
      transfersService.create.mockResolvedValue({ id: 'tx-1', txHash: 'HASH' } as any);
      participantRepo.save.mockResolvedValue(mockParticipant({ status: SplitParticipantStatus.PAID }));

      await service.pay('split-1', 'user-alice', 'alice');

      expect(transfersService.create).toHaveBeenCalledWith(
        'user-alice',
        'alice',
        expect.objectContaining({ toUsername: 'initiator', amount: '15.000000' }),
      );
      expect(participantRepo.save).toHaveBeenCalled();
    });

    it('marks split completed when all participants paid', async () => {
      splitRepo.findOne.mockResolvedValue(mockSplit());
      participantRepo.findOne.mockResolvedValue(mockParticipant());
      participantRepo.count.mockResolvedValue(0); // no more pending
      usersService.findById.mockResolvedValue(mockUser('user-initiator', 'initiator') as any);
      transfersService.create.mockResolvedValue({ id: 'tx-1' } as any);
      participantRepo.save.mockResolvedValue({});

      await service.pay('split-1', 'user-alice', 'alice');

      expect(splitRepo.update).toHaveBeenCalledWith('split-1', {
        status: SplitRequestStatus.COMPLETED,
      });
    });

    it('throws ForbiddenException if initiator tries to pay own split', async () => {
      splitRepo.findOne.mockResolvedValue(mockSplit({ initiatorId: 'user-initiator' }));

      await expect(service.pay('split-1', 'user-initiator', 'initiator')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── decline ───────────────────────────────────────────────────────────────

  describe('decline', () => {
    it('marks participant declined and notifies initiator', async () => {
      splitRepo.findOne.mockResolvedValue(mockSplit());
      participantRepo.findOne.mockResolvedValue(mockParticipant());
      participantRepo.save.mockResolvedValue(mockParticipant({ status: SplitParticipantStatus.DECLINED }));

      await service.decline('split-1', 'user-alice');

      expect(participantRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SplitParticipantStatus.DECLINED }),
      );
      expect(notificationService.create).toHaveBeenCalledWith(
        'user-initiator',
        expect.any(String),
        expect.stringContaining('declined'),
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  // ── cancel ────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('cancels split and notifies all participants', async () => {
      splitRepo.findOne.mockResolvedValue(mockSplit());
      splitRepo.save.mockResolvedValue(mockSplit({ status: SplitRequestStatus.CANCELLED }));
      participantRepo.update.mockResolvedValue({});
      participantRepo.find.mockResolvedValue([mockParticipant(), mockParticipant({ id: 'part-2', userId: 'user-bob', username: 'bob' })]);

      await service.cancel('split-1', 'user-initiator');

      expect(splitRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SplitRequestStatus.CANCELLED }),
      );
      expect(notificationService.create).toHaveBeenCalledTimes(2);
    });

    it('throws ForbiddenException if non-initiator tries to cancel', async () => {
      splitRepo.findOne.mockResolvedValue(mockSplit({ initiatorId: 'user-initiator' }));

      await expect(service.cancel('split-1', 'user-alice')).rejects.toThrow(ForbiddenException);
    });
  });
});
