import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RestoreController } from './restore.controller';
import { SoftDeleteService } from './soft-delete.service';
import { Split } from '../entities/split.entity';
import { Participant } from '../entities/participant.entity';

describe('RestoreController', () => {
  let controller: RestoreController;
  let softDeleteService: SoftDeleteService;

  const mockSplit = { id: 'split-uuid', totalAmount: 100, deletedAt: null } as Split;
  const mockParticipant = { id: 'part-uuid', splitId: 'split-uuid', userId: 'u1', deletedAt: null } as Participant;

  const mockSoftDeleteService = {
    restoreSplit: jest.fn().mockResolvedValue(mockSplit),
    restoreParticipant: jest.fn().mockResolvedValue(mockParticipant),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSoftDeleteService.restoreSplit.mockResolvedValue(mockSplit);
    mockSoftDeleteService.restoreParticipant.mockResolvedValue(mockParticipant);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestoreController],
      providers: [
        { provide: SoftDeleteService, useValue: mockSoftDeleteService },
      ],
    }).compile();

    controller = module.get<RestoreController>(RestoreController);
    softDeleteService = module.get<SoftDeleteService>(SoftDeleteService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('restoreSplit', () => {
    it('should restore split and return it', async () => {
      const result = await controller.restoreSplit('split-uuid');
      expect(result).toEqual(mockSplit);
      expect(softDeleteService.restoreSplit).toHaveBeenCalledWith('split-uuid');
    });

    it('should throw when service throws', async () => {
      mockSoftDeleteService.restoreSplit.mockRejectedValue(new NotFoundException('not found'));
      await expect(controller.restoreSplit('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('restoreParticipant', () => {
    it('should restore participant and return it', async () => {
      const result = await controller.restoreParticipant('part-uuid');
      expect(result).toEqual(mockParticipant);
      expect(softDeleteService.restoreParticipant).toHaveBeenCalledWith('part-uuid');
    });
  });
});
