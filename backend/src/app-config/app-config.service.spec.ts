import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { AppConfig } from './entities/app-config.entity';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../audit/audit.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRepo = {
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  find: jest.fn(),
  upsert: jest.fn(),
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockAudit = {
  log: jest.fn(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeConfig = (overrides: Partial<AppConfig> = {}): AppConfig =>
  ({
    id: 'cfg-uuid-1',
    key: 'maintenance_mode',
    value: false,
    description: 'Put the app in maintenance mode',
    updatedBy: null,
    updatedAt: new Date(),
    ...overrides,
  } as AppConfig);

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('AppConfigService', () => {
  let service: AppConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        { provide: getRepositoryToken(AppConfig), useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
  });

  // ── get ────────────────────────────────────────────────────────────────────

  describe('get', () => {
    it('returns cached value without hitting DB', async () => {
      mockCache.get.mockResolvedValue(true);

      const result = await service.get<boolean>('maintenance_mode');

      expect(result).toBe(true);
      expect(mockRepo.findOne).not.toHaveBeenCalled();
    });

    it('loads from DB on cache miss and caches result', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepo.findOne.mockResolvedValue(makeConfig({ value: false }));
      mockCache.set.mockResolvedValue(true);

      const result = await service.get<boolean>('maintenance_mode');

      expect(result).toBe(false);
      expect(mockCache.set).toHaveBeenCalledWith('config:maintenance_mode', false, 60);
    });

    it('returns defaultValue when key not in DB', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.get<boolean>('unknown_key', true);

      expect(result).toBe(true);
    });
  });

  // ── set ────────────────────────────────────────────────────────────────────

  describe('set', () => {
    it('upserts DB, invalidates cache, and logs audit', async () => {
      mockRepo.upsert.mockResolvedValue(undefined);
      mockCache.del.mockResolvedValue(undefined);
      mockAudit.log.mockResolvedValue(undefined);
      mockRepo.findOneOrFail.mockResolvedValue(makeConfig({ value: true }));

      const result = await service.set('maintenance_mode', true, 'admin-uuid');

      expect(mockRepo.upsert).toHaveBeenCalledWith(
        { key: 'maintenance_mode', value: true, updatedBy: 'admin-uuid' },
        { conflictPaths: ['key'], skipUpdateIfNoValuesChanged: false },
      );
      expect(mockCache.del).toHaveBeenCalledWith('config:maintenance_mode');
      expect(mockAudit.log).toHaveBeenCalledWith('admin-uuid', 'config.set',
        JSON.stringify({ key: 'maintenance_mode', value: true }),
      );
      expect(result.value).toBe(true);
    });

    it('invalidates cache even when no updatedBy provided', async () => {
      mockRepo.upsert.mockResolvedValue(undefined);
      mockCache.del.mockResolvedValue(undefined);
      mockRepo.findOneOrFail.mockResolvedValue(makeConfig());

      await service.set('maintenance_mode', false);

      expect(mockCache.del).toHaveBeenCalledWith('config:maintenance_mode');
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for non-serialisable value', async () => {
      const circular: Record<string, unknown> = {};
      circular['self'] = circular;

      await expect(service.set('bad_key', circular)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepo.upsert).not.toHaveBeenCalled();
    });
  });

  // ── getAll ─────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns all configs ordered by key', async () => {
      const configs = [makeConfig({ key: 'a' }), makeConfig({ key: 'b' })];
      mockRepo.find.mockResolvedValue(configs);

      const result = await service.getAll();

      expect(result).toHaveLength(2);
      expect(mockRepo.find).toHaveBeenCalledWith({ order: { key: 'ASC' } });
    });
  });
});
