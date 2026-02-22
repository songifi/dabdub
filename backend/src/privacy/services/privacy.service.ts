import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { DataDeletionRequest } from '../entities/data-deletion-request.entity';
import { DeletionRequestStatus } from '../enums/deletion-request-status.enum';
import { UpdateDeletionRequestDto } from '../dto/update-deletion-request.dto';

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    @InjectRepository(DataDeletionRequest)
    private readonly deletionRepo: Repository<DataDeletionRequest>,
  ) {}

  async getAllDeletionRequests(): Promise<DataDeletionRequest[]> {
    return this.deletionRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getDeletionRequest(id: string): Promise<DataDeletionRequest> {
    const request = await this.deletionRepo.findOne({ where: { id } });
    if (!request) {
      throw new BadRequestException('Deletion request not found');
    }
    return request;
  }

  async updateDeletionRequest(
    id: string,
    dto: UpdateDeletionRequestDto,
  ): Promise<DataDeletionRequest> {
    const request = await this.getDeletionRequest(id);

    request.status = dto.status;
    request.reviewNote = dto.reviewNote;

    if (dto.legalHoldExpiresAt) {
      request.legalHoldExpiresAt = new Date(dto.legalHoldExpiresAt);
    }

    return this.deletionRepo.save(request);
  }

  async validateExecutionEligibility(id: string): Promise<void> {
    const request = await this.getDeletionRequest(id);

    if (request.status !== DeletionRequestStatus.APPROVED) {
      throw new BadRequestException('Request must be APPROVED to execute');
    }

    if (
      request.legalHoldExpiresAt &&
      request.legalHoldExpiresAt > new Date()
    ) {
      throw new BadRequestException('Legal hold is still active');
    }
  }

  async markAsProcessing(id: string): Promise<void> {
    await this.deletionRepo.update(id, {
      status: DeletionRequestStatus.PROCESSING,
    });
  }

  async markAsCompleted(
    id: string,
    deletedDataSummary: Record<string, number>,
  ): Promise<void> {
    await this.deletionRepo.update(id, {
      status: DeletionRequestStatus.COMPLETED,
      completedAt: new Date(),
      deletedDataSummary,
    });
  }
}
