import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { SoftDeleteService } from './soft-delete.service';
import { Split } from '../entities/split.entity';
import { Participant } from '../entities/participant.entity';

describe('SoftDeleteService', () => {
  let service: SoftDeleteService;
  let splitRepo: Repository<Split>;
  let participantRepo: Repository<Participant>;

  const mockSplit = { id: 'split-uuid', totalAmount: 100, deletedAt: new Date() } as Split;
  const mockParticipant = { id: 'part-uuid', splitId: 'split-uuid', userId: 'u1', deletedAt: new Date() } as Participant;

  const mockSplitRepo = {
    restore: jest.fn().mockResolvedValue({ affected: 1 }),
    findOne: jest.fn().mockResolvedValue({ ...mockSplit, deletedAt: null }),
  };
  const mockParticipantRepo = {
    restore: jest.fn().mockResolvedValue({ affected: 1 }),
    findOne: jest.fn().mockResolvedValue({ ...mockParticipant, deletedAt: null }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSplitRepo.restore.mockResolvedValue({ affected: 1 });
    mockSplitRepo.findOne.mockResolvedValue({ ...mockSplit, deletedAt: null });
    mockParticipantRepo.restore.mockResolvedValue({ affected: 1 });
    mockParticipantRepo.findOne.mockResolvedValue({ ...mockParticipant, deletedAt: null });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SoftDeleteService,
        { provide: getRepositoryToken(Split), useValue: mockSplitRepo },
        { provide: getRepositoryToken(Participant), useValue: mockParticipantRepo },
      ],
    }).compile();

    service = module.get<SoftDeleteService>(SoftDeleteService);
    splitRepo = module.get(getRepositoryToken(Split));
    participantRepo = module.get(getRepositoryToken(Participant));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('restoreSplit', () => {
    it('should restore a soft-deleted split', async () => {
      const result = await service.restoreSplit('split-uuid');
      expect(mockSplitRepo.restore).toHaveBeenCalledWith('split-uuid');
      expect(mockSplitRepo.findOne).toHaveBeenCalledWith({ where: { id: 'split-uuid' } });
      expect(result.deletedAt).toBeNull();
    });

    it('should throw NotFoundException when restore affects 0', async () => {
      mockSplitRepo.restore.mockResolvedValue({ affected: 0 });
      await expect(service.restoreSplit('missing')).rejects.toThrow(NotFoundException);
      await expect(service.restoreSplit('missing')).rejects.toThrow(/not found or not soft-deleted/);
    });
  });

  describe('restoreParticipant', () => {
    it('should restore a soft-deleted participant', async () => {
      const result = await service.restoreParticipant('part-uuid');
      expect(mockParticipantRepo.restore).toHaveBeenCalledWith('part-uuid');
      expect(result.deletedAt).toBeNull();
    });

    it('should throw NotFoundException when restore affects 0', async () => {
      mockParticipantRepo.restore.mockResolvedValue({ affected: 0 });
      await expect(service.restoreParticipant('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
