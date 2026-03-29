import { describe, expect, it, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { Repository, And, MoreThan, LessThanOrEqual } from 'typeorm';
import { Queue } from 'bull';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MaintenanceService, MAINTENANCE_QUEUE } from './maintenance.service';
import { MaintenanceWindow, MaintenanceStatus } from './entities/maintenance-window.entity';
import { CacheService } from '../cache/cache.service';
import { CreateMaintenanceWindowDto } from './dto/create-maintenance-window.dto';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let repository: jest.Mocked<Repository<MaintenanceWindow>>;
  let cacheService: jest.Mocked<CacheService>;
  let queue: jest.Mocked<Queue>;

  const mockWindow: MaintenanceWindow = {
    id: 'test-id',
    title: 'Test Maintenance',
    description: 'Test description',
    startAt: new Date('2024-03-30T02:00:00Z'),
    endAt: new Date('2024-03-30T06:00:00Z'),
    affectedServices: ['transfers'],
    status: MaintenanceStatus.SCHEDULED,
    createdBy: 'admin-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        {
          provide: getRepositoryToken(MaintenanceWindow),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: getQueueToken(MAINTENANCE_QUEUE),
          useValue: {
            add: jest.fn(),
            getJob: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
    repository = module.get(getRepositoryToken(MaintenanceWindow));
    cacheService = module.get(CacheService);
    queue = module.get(getQueueToken(MAINTENANCE_QUEUE));
  });

  describe('getUpcoming', () => {
    it('should return cached upcoming windows', async () => {
      const cachedWindows = [mockWindow];
      cacheService.get.mockResolvedValue(cachedWindows);

      const result = await service.getUpcoming();

      expect(result).toEqual(cachedWindows);
      expect(cacheService.get).toHaveBeenCalledWith('maintenance:upcoming');
      expect(repository.find).not.toHaveBeenCalled();
    });

    it('should query database and cache when no cache exists', async () => {
      const windows = [mockWindow];
      cacheService.get.mockResolvedValue(null);
      repository.find.mockResolvedValue(windows);

      const result = await service.getUpcoming();

      expect(result).toEqual(windows);
      expect(repository.find).toHaveBeenCalledWith({
        where: {
          status: MaintenanceStatus.SCHEDULED,
          startAt: And(MoreThan(expect.any(Date)), LessThanOrEqual(expect.any(Date))),
        },
        order: { startAt: 'ASC' },
      });
      expect(cacheService.set).toHaveBeenCalledWith('maintenance:upcoming', windows, 300);
    });
  });

  describe('getActive', () => {
    it('should return cached active windows', async () => {
      const cachedWindows = [{ ...mockWindow, status: MaintenanceStatus.ACTIVE }];
      cacheService.get.mockResolvedValue(cachedWindows);

      const result = await service.getActive();

      expect(result).toEqual(cachedWindows);
      expect(cacheService.get).toHaveBeenCalledWith('maintenance:active');
    });

    it('should query database when no cache exists', async () => {
      const activeWindow = { ...mockWindow, status: MaintenanceStatus.ACTIVE };
      cacheService.get.mockResolvedValue(null);
      repository.find.mockResolvedValue([activeWindow]);

      const result = await service.getActive();

      expect(result).toEqual([activeWindow]);
      expect(repository.find).toHaveBeenCalledWith({
        where: {
          status: MaintenanceStatus.ACTIVE,
          startAt: LessThanOrEqual(expect.any(Date)),
          endAt: MoreThan(expect.any(Date)),
        },
        order: { startAt: 'ASC' },
      });
    });
  });

  describe('create', () => {
    const createDto: CreateMaintenanceWindowDto = {
      title: 'Test Maintenance',
      description: 'Test description',
      startAt: '2024-03-30T02:00:00Z',
      endAt: '2024-03-30T06:00:00Z',
      affectedServices: ['transfers'],
    };

    it('should create a maintenance window successfully', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-29T00:00:00Z'));
      try {
        repository.create.mockReturnValue(mockWindow);
        repository.save.mockResolvedValue(mockWindow);
        queue.add.mockResolvedValue({} as any);

        const result = await service.create(createDto, 'admin-id');

        expect(result).toEqual(mockWindow);
        expect(repository.create).toHaveBeenCalledWith({
          ...createDto,
          startAt: new Date(createDto.startAt),
          endAt: new Date(createDto.endAt),
          createdBy: 'admin-id',
        });
        expect(queue.add).toHaveBeenCalledTimes(4); // start, end, notify_24h, notify_1h

        const notify24h = queue.add.mock.calls.find(
          (c) => (c[0] as { action?: string }).action === 'notify_24h',
        );
        const notify1h = queue.add.mock.calls.find(
          (c) => (c[0] as { action?: string }).action === 'notify_1h',
        );
        expect(notify24h?.[1]).toMatchObject({
          delay: 2 * 60 * 60 * 1000,
          jobId: `notify24h-${mockWindow.id}`,
        });
        expect(notify1h?.[1]).toMatchObject({
          delay: 25 * 60 * 60 * 1000,
          jobId: `notify1h-${mockWindow.id}`,
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('should throw error if start time is after end time', async () => {
      const invalidDto = {
        ...createDto,
        startAt: '2024-03-30T06:00:00Z',
        endAt: '2024-03-30T02:00:00Z',
      };

      await expect(service.create(invalidDto, 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if start time is in the past', async () => {
      const pastDto = {
        ...createDto,
        startAt: '2020-01-01T00:00:00Z',
      };

      await expect(service.create(pastDto, 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel a scheduled maintenance window', async () => {
      const scheduledWindow = { ...mockWindow, status: MaintenanceStatus.SCHEDULED };
      const cancelledWindow = { ...scheduledWindow, status: MaintenanceStatus.CANCELLED };
      
      repository.findOne.mockResolvedValue(scheduledWindow);
      repository.save.mockResolvedValue(cancelledWindow);
      queue.getJob.mockResolvedValue({ remove: jest.fn() } as any);

      const result = await service.cancel('test-id');

      expect(result).toEqual(cancelledWindow);
      expect(repository.save).toHaveBeenCalledWith({
        ...scheduledWindow,
        status: MaintenanceStatus.CANCELLED,
      });
      expect(queue.add).toHaveBeenCalledWith(
        { windowId: 'test-id', action: 'cancel_notify' },
        expect.objectContaining({ removeOnComplete: true }),
      );
    });

    it('should throw error if window not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.cancel('test-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw error if window is not scheduled', async () => {
      const activeWindow = { ...mockWindow, status: MaintenanceStatus.ACTIVE };
      repository.findOne.mockResolvedValue(activeWindow);

      await expect(service.cancel('test-id')).rejects.toThrow(BadRequestException);
    });
  });

  describe('setActive', () => {
    it('should set maintenance window to active', async () => {
      await service.setActive('test-id');

      expect(repository.update).toHaveBeenCalledWith('test-id', {
        status: MaintenanceStatus.ACTIVE,
      });
      expect(cacheService.del).toHaveBeenCalledTimes(2);
    });
  });

  describe('setCompleted', () => {
    it('should set maintenance window to completed', async () => {
      await service.setCompleted('test-id');

      expect(repository.update).toHaveBeenCalledWith('test-id', {
        status: MaintenanceStatus.COMPLETED,
      });
      expect(cacheService.del).toHaveBeenCalledTimes(2);
    });
  });
});