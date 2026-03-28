import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLog, ActorType } from './entities/audit-log.entity';
import type { CreateAuditLogDto } from './dto/create-audit-log.dto';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

describe('AuditService', () => {
  let service: AuditService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(AuditService);
    repo = module.get(getRepositoryToken(AuditLog));
  });

  describe('log()', () => {
    it('should INSERT a new audit log entry', async () => {
      const dto: CreateAuditLogDto = {
        actorId: 'admin-1',
        actorType: ActorType.ADMIN,
        action: 'kyc.approved',
        resourceType: 'kyc',
        resourceId: 'user-42',
        before: { kycStatus: 'pending' },
        after: { kycStatus: 'approved' },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        correlationId: 'corr-123',
      };

      const created = { id: 'log-1', ...dto };
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.log(dto);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        actorId: 'admin-1',
        action: 'kyc.approved',
        before: { kycStatus: 'pending' },
        after: { kycStatus: 'approved' },
      }));
      expect(repo.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(created);
    });

    it('should never call update or delete', async () => {
      const dto: CreateAuditLogDto = {
        actorId: 'system',
        actorType: ActorType.SYSTEM,
        action: 'user.freeze',
        resourceType: 'user',
        resourceId: 'user-1',
      };
      repo.create.mockReturnValue(dto);
      repo.save.mockResolvedValue({ id: 'x', ...dto });

      await service.log(dto);

      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('findById()', () => {
    it('should return the log when found', async () => {
      const log = { id: 'log-1', action: 'kyc.approved' } as AuditLog;
      repo.findOne.mockResolvedValue(log);

      const result = await service.findById('log-1');
      expect(result).toBe(log);
    });

    it('should throw NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll()', () => {
    it('should return paginated results', async () => {
      const logs = [{ id: 'log-1' }, { id: 'log-2' }] as AuditLog[];
      repo.findAndCount.mockResolvedValue([logs, 2]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(logs);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should apply action prefix filter with LIKE', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ action: 'kyc' });

      const [whereArg] = repo.findAndCount.mock.calls[0];
      // action should be a Like('kyc%') condition
      expect(JSON.stringify(whereArg.where)).toContain('kyc');
    });
  });
});
