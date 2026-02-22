import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { DataRetentionPolicy } from '../entities/data-retention-policy.entity';
import { UpdateRetentionPolicyDto } from '../dto/update-retention-policy.dto';

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    @InjectRepository(DataRetentionPolicy)
    private readonly policyRepo: Repository<DataRetentionPolicy>,
  ) {}

  async getAllPolicies(): Promise<DataRetentionPolicy[]> {
    return this.policyRepo.find({ order: { dataType: 'ASC' } });
  }

  async updatePolicy(
    dataType: string,
    dto: UpdateRetentionPolicyDto,
  ): Promise<DataRetentionPolicy> {
    let policy = await this.policyRepo.findOne({ where: { dataType } });

    if (!policy) {
      policy = this.policyRepo.create({ dataType, ...dto });
    } else {
      Object.assign(policy, dto);
    }

    return this.policyRepo.save(policy);
  }

  async getPurgeHistory(): Promise<any[]> {
    const policies = await this.policyRepo.find({
      where: { lastPurgeRunAt: Not(null) },
      order: { lastPurgeRunAt: 'DESC' },
    });

    return policies.map((p) => ({
      dataType: p.dataType,
      rowsDeleted: p.lastPurgeDeletedCount,
      runAt: p.lastPurgeRunAt,
    }));
  }

  async updatePurgeStats(
    dataType: string,
    deletedCount: number,
  ): Promise<void> {
    await this.policyRepo.update(
      { dataType },
      {
        lastPurgeRunAt: new Date(),
        lastPurgeDeletedCount: deletedCount,
      },
    );
  }
}
