import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { Settlement, SettlementStatus } from '../entities/settlement.entity';
import { REDIS_CLIENT } from '../../cache/redis.module';
import { QueueRegistryService } from '../../queue/queue.registry';

@Injectable()
export class SettlementProcessor implements OnModuleInit {
  private readonly logger = new Logger(SettlementProcessor.name);

  constructor(
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly queueRegistry: QueueRegistryService,
  ) {}

  onModuleInit() {
    this.queueRegistry.registerHandler('settlement-jobs', (job) => this.handle(job));
    this.logger.log('SettlementProcessor registered to settlement-jobs queue');
  }

  async handle(job: Job<{ settlementId: string; merchantId: string }>) {
    const { settlementId, merchantId } = job.data;
    const lockKey = `lock:settlement:merchant:${merchantId}`;
    
    const acquired = await this.redis.set(lockKey, 'locked', 'EX', 60, 'NX');
    
    if (!acquired) {
      this.logger.debug(`Concurrency lock active for merchant ${merchantId}. Throwing for retry.`);
      throw new Error(`Merchant ${merchantId} is already processing a settlement. Retrying later.`);
    }

    try {
      this.logger.log(`Worker started processing settlement ${settlementId} for merchant ${merchantId}`);
      
      const settlement = await this.settlementRepo.findOne({ where: { id: settlementId } });
      if (!settlement) {
        this.logger.error(`Settlement ${settlementId} not found in database.`);
        return;
      }

      if (settlement.status === SettlementStatus.SETTLED) {
        this.logger.warn(`Settlement ${settlementId} is already marked as SETTLED.`);
        return;
      }

      settlement.status = SettlementStatus.PROCESSING;
      await this.settlementRepo.save(settlement);

      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      settlement.status = SettlementStatus.SETTLED;
      settlement.settledAt = new Date();
      settlement.providerRef = `SETTLE_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      
      await this.settlementRepo.save(settlement);
      this.logger.log(`Settlement ${settlementId} completed successfully.`);

      return { success: true, settlementId };
    } catch (error) {
      this.logger.error(`Failed to process settlement ${settlementId}: ${error instanceof Error ? error.message : String(error)}`);
      
      const settlement = await this.settlementRepo.findOne({ where: { id: settlementId } });
      if (settlement && job.attemptsMade >= (job.opts.attempts || 1)) {
        settlement.status = SettlementStatus.FAILED;
        settlement.failureReason = error instanceof Error ? error.message : String(error);
        await this.settlementRepo.save(settlement);
      }
      
      throw error;
    } finally {
      await this.redis.del(lockKey);
      this.logger.debug(`Lock released for merchant ${merchantId}`);
    }
  }
}
