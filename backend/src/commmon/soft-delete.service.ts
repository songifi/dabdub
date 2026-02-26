import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Split } from '../entities/split.entity';
import { Participant } from '../entities/participant.entity';

/**
 * Service for soft-delete and restore of Split and Participant.
 * Use repository.softDelete(id) or repository.softRemove(entity) for DELETE;
 * use this service's restore methods for admin restore.
 */
@Injectable()
export class SoftDeleteService {
  constructor(
    @InjectRepository(Split)
    private readonly splitRepository: Repository<Split>,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
  ) {}

  async restoreSplit(id: string): Promise<Split> {
    const result = await this.splitRepository.restore(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Split with ID ${id} not found or not soft-deleted`);
    }
    const split = await this.splitRepository.findOne({ where: { id } });
    if (!split) {
      throw new NotFoundException(`Split with ID ${id} not found`);
    }
    return split;
  }

  async restoreParticipant(id: string): Promise<Participant> {
    const result = await this.participantRepository.restore(id);
    if (result.affected === 0) {
      throw new NotFoundException(
        `Participant with ID ${id} not found or not soft-deleted`,
      );
    }
    const participant = await this.participantRepository.findOne({
      where: { id },
      relations: ['split'],
    });
    if (!participant) {
      throw new NotFoundException(`Participant with ID ${id} not found`);
    }
    return participant;
  }
}
