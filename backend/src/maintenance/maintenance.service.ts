import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThanOrEqual, And } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CacheService } from '../cache/cache.service';
import { MaintenanceWindow, MaintenanceStatus } from './entities/maintenance-window.entity';
import { CreateMaintenanceWindowDto } from './dto/create-maintenance-window.dto';

const CACHE_KEYS = {
  UPCOMING: 'maintenance:upcoming',
  ACTIVE: 'maintenance:active',
} as const;

const CACHE_TTL = {
  UPCOMING: 300, // 5 minutes
  ACTIVE: 30,    // 30 seconds
} as const;

export const MAINTENANCE_QUEUE = 'maintenance';

export interface MaintenanceJobPayload {
  windowId: string;
  action: 'start' | 'end' | 'notify_24h' | 'notify_1h' | 'cancel_notify';
}

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    @InjectRepository(MaintenanceWindow)
    private readonly windowRepo: Repository<MaintenanceWindow>,
    
    private readonly cacheService: CacheService,
    
    @InjectQueue(MAINTENANCE_QUEUE)
    private readonly maintenanceQueue: Queue<MaintenanceJobPayload>,
  ) {}

  async getUpcoming(): Promise<MaintenanceWindow[]> {
    // Check cache first
    const cached = await this.cacheService.get<MaintenanceWindow[]>(CACHE_KEYS.UPCOMING);
    if (cached) {
      return cached;
    }

    // Query DB for scheduled windows starting in next 72h
    const now = new Date();
    const next72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    const windows = await this.windowRepo.find({
      where: {
        status: MaintenanceStatus.SCHEDULED,
        startAt: And(MoreThan(now), LessThanOrEqual(next72h)),
      },
      order: { startAt: 'ASC' },
    });

    // Cache for 5 minutes
    await this.cacheService.set(CACHE_KEYS.UPCOMING, windows, CACHE_TTL.UPCOMING);
    
    return windows;
  }

  async getActive(): Promise<MaintenanceWindow[]> {
    // Check cache first
    const cached = await this.cacheService.get<MaintenanceWindow[]>(CACHE_KEYS.ACTIVE);
    if (cached) {
      return cached;
    }

    // Query DB for currently active windows
    const now = new Date();
    
    const windows = await this.windowRepo.find({
      where: {
        status: MaintenanceStatus.ACTIVE,
        startAt: LessThanOrEqual(now),
        endAt: MoreThan(now),
      },
      order: { startAt: 'ASC' },
    });

    // Cache for 30 seconds
    await this.cacheService.set(CACHE_KEYS.ACTIVE, windows, CACHE_TTL.ACTIVE);
    
    return windows;
  }

  async create(dto: CreateMaintenanceWindowDto, createdBy: string): Promise<MaintenanceWindow> {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    
    // Validation
    if (startAt >= endAt) {
      throw new BadRequestException('Start time must be before end time');
    }
    
    if (startAt <= new Date()) {
      throw new BadRequestException('Start time must be in the future');
    }

    const window = this.windowRepo.create({
      ...dto,
      startAt,
      endAt,
      createdBy,
    });

    const saved = await this.windowRepo.save(window);
    
    // Schedule jobs
    await this.scheduleJobs(saved);
    
    // Invalidate cache
    await this.invalidateCache();
    
    this.logger.log(`Maintenance window created: ${saved.id}`);
    
    return saved;
  }

  async cancel(id: string): Promise<MaintenanceWindow> {
    const window = await this.windowRepo.findOne({ where: { id } });
    
    if (!window) {
      throw new NotFoundException('Maintenance window not found');
    }
    
    if (window.status !== MaintenanceStatus.SCHEDULED) {
      throw new BadRequestException('Can only cancel scheduled windows');
    }

    window.status = MaintenanceStatus.CANCELLED;
    const updated = await this.windowRepo.save(window);
    
    // Remove scheduled jobs
    await this.removeJobs(id);

    await this.maintenanceQueue.add(
      { windowId: id, action: 'cancel_notify' },
      { removeOnComplete: true },
    );

    // Invalidate cache
    await this.invalidateCache();

    this.logger.log(`Maintenance window cancelled: ${id}`);
    
    return updated;
  }

  async findAll(): Promise<MaintenanceWindow[]> {
    return this.windowRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['creator'],
    });
  }

  async findById(id: string): Promise<MaintenanceWindow> {
    const window = await this.windowRepo.findOne({ 
      where: { id },
      relations: ['creator'],
    });
    
    if (!window) {
      throw new NotFoundException('Maintenance window not found');
    }
    
    return window;
  }

  async setActive(id: string): Promise<void> {
    await this.windowRepo.update(id, { status: MaintenanceStatus.ACTIVE });
    await this.invalidateCache();
    this.logger.log(`Maintenance window activated: ${id}`);
  }

  async setCompleted(id: string): Promise<void> {
    await this.windowRepo.update(id, { status: MaintenanceStatus.COMPLETED });
    await this.invalidateCache();
    this.logger.log(`Maintenance window completed: ${id}`);
  }

  private async scheduleJobs(window: MaintenanceWindow): Promise<void> {
    const windowId = window.id;
    
    // Schedule start job
    await this.maintenanceQueue.add(
      { windowId, action: 'start' },
      { delay: window.startAt.getTime() - Date.now(), jobId: `start-${windowId}` }
    );
    
    // Schedule end job
    await this.maintenanceQueue.add(
      { windowId, action: 'end' },
      { delay: window.endAt.getTime() - Date.now(), jobId: `end-${windowId}` }
    );
    
    // Schedule 24h notification
    const notify24h = window.startAt.getTime() - 24 * 60 * 60 * 1000;
    if (notify24h > Date.now()) {
      await this.maintenanceQueue.add(
        { windowId, action: 'notify_24h' },
        { delay: notify24h - Date.now(), jobId: `notify24h-${windowId}` }
      );
    }
    
    // Schedule 1h notification
    const notify1h = window.startAt.getTime() - 60 * 60 * 1000;
    if (notify1h > Date.now()) {
      await this.maintenanceQueue.add(
        { windowId, action: 'notify_1h' },
        { delay: notify1h - Date.now(), jobId: `notify1h-${windowId}` }
      );
    }
  }

  private async removeJobs(windowId: string): Promise<void> {
    const jobIds = [
      `start-${windowId}`,
      `end-${windowId}`,
      `notify24h-${windowId}`,
      `notify1h-${windowId}`,
    ];
    
    for (const jobId of jobIds) {
      try {
        const job = await this.maintenanceQueue.getJob(jobId);
        if (job) {
          await job.remove();
        }
      } catch (error) {
        this.logger.warn(`Failed to remove job ${jobId}: ${error}`);
      }
    }
  }

  private async invalidateCache(): Promise<void> {
    await Promise.all([
      this.cacheService.del(CACHE_KEYS.UPCOMING),
      this.cacheService.del(CACHE_KEYS.ACTIVE),
    ]);
  }
}