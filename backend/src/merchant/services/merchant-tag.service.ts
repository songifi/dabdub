import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MerchantTag } from '../entities/merchant-tag.entity';
import { MerchantTagAssignment } from '../entities/merchant-tag-assignment.entity';
import {
  CreateTagDto,
  UpdateTagDto,
  MerchantTagResponseDto,
  AssignTagDto,
  MerchantTagAssignmentResponseDto,
} from '../dto/merchant-tag.dto';

@Injectable()
export class MerchantTagService {
  constructor(
    @InjectRepository(MerchantTag)
    private readonly tagRepository: Repository<MerchantTag>,
    @InjectRepository(MerchantTagAssignment)
    private readonly assignmentRepository: Repository<MerchantTagAssignment>,
  ) {}

  async createTag(dto: CreateTagDto): Promise<MerchantTagResponseDto> {
    const tag = this.tagRepository.create({
      name: dto.name,
      color: dto.color,
      description: dto.description || null,
    });

    const savedTag = await this.tagRepository.save(tag);
    return this.mapToResponseDto(savedTag);
  }

  async getAllTags(): Promise<MerchantTagResponseDto[]> {
    const tags = await this.tagRepository.find({
      order: { createdAt: 'DESC' },
    });
    return tags.map((tag) => this.mapToResponseDto(tag));
  }

  async getTagById(tagId: string): Promise<MerchantTagResponseDto> {
    const tag = await this.tagRepository.findOne({ where: { id: tagId } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    return this.mapToResponseDto(tag);
  }

  async updateTag(
    tagId: string,
    dto: UpdateTagDto,
  ): Promise<MerchantTagResponseDto> {
    const tag = await this.tagRepository.findOne({ where: { id: tagId } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    if (dto.name !== undefined) {
      tag.name = dto.name;
    }
    if (dto.color !== undefined) {
      tag.color = dto.color;
    }
    if (dto.description !== undefined) {
      tag.description = dto.description;
    }

    const updatedTag = await this.tagRepository.save(tag);
    return this.mapToResponseDto(updatedTag);
  }

  async deleteTag(tagId: string): Promise<void> {
    const tag = await this.tagRepository.findOne({ where: { id: tagId } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Check if tag has active assignments
    const assignmentCount = await this.assignmentRepository.count({
      where: { tagId },
    });

    if (assignmentCount > 0) {
      throw new ConflictException(
        `Cannot delete tag with ${assignmentCount} active assignment(s)`,
      );
    }

    await this.tagRepository.delete(tagId);
  }

  async assignTagToMerchant(
    merchantId: string,
    assignedById: string,
    dto: AssignTagDto,
  ): Promise<MerchantTagAssignmentResponseDto> {
    // Verify tag exists
    const tag = await this.tagRepository.findOne({
      where: { id: dto.tagId },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Check if already assigned
    const existing = await this.assignmentRepository.findOne({
      where: {
        merchantId,
        tagId: dto.tagId,
      },
    });

    if (existing) {
      throw new ConflictException('Tag already assigned to this merchant');
    }

    const assignment = this.assignmentRepository.create({
      merchantId,
      tagId: dto.tagId,
      assignedById,
    });

    const savedAssignment = await this.assignmentRepository.save(assignment);
    return this.mapAssignmentToResponseDto(savedAssignment, tag);
  }

  async removeTagFromMerchant(
    merchantId: string,
    tagId: string,
  ): Promise<void> {
    const assignment = await this.assignmentRepository.findOne({
      where: { merchantId, tagId },
    });

    if (!assignment) {
      throw new NotFoundException('Tag assignment not found');
    }

    await this.assignmentRepository.delete(assignment.id);
  }

  async getMerchantTags(
    merchantId: string,
  ): Promise<MerchantTagAssignmentResponseDto[]> {
    const assignments = await this.assignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.tag', 'tag')
      .where('assignment.merchantId = :merchantId', { merchantId })
      .getMany();

    return assignments.map((assignment) =>
      this.mapAssignmentToResponseDto(assignment, assignment.tag),
    );
  }

  async getMerchantsByTags(tagNames: string[]): Promise<string[]> {
    // Get tags by name
    const tags = await this.tagRepository.find({
      where: { name: In(tagNames) },
    });

    if (tags.length === 0) {
      return [];
    }

    const tagIds = tags.map((t) => t.id);

    // Find merchants that have ALL specified tags
    const assignmentsByMerchant = await this.assignmentRepository
      .createQueryBuilder('assignment')
      .select('assignment.merchantId', 'merchantId')
      .addSelect('COUNT(assignment.tagId)', 'tagCount')
      .where('assignment.tagId IN (:...tagIds)', { tagIds })
      .groupBy('assignment.merchantId')
      .having('COUNT(assignment.tagId) = :requiredCount', {
        requiredCount: tagIds.length,
      })
      .getRawMany();

    return assignmentsByMerchant.map((row) => row.merchantId);
  }

  private mapToResponseDto(tag: MerchantTag): MerchantTagResponseDto {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }

  private mapAssignmentToResponseDto(
    assignment: MerchantTagAssignment,
    tag: MerchantTag,
  ): MerchantTagAssignmentResponseDto {
    return {
      id: assignment.id,
      merchantId: assignment.merchantId,
      tagId: assignment.tagId,
      tag: this.mapToResponseDto(tag),
      assignedById: assignment.assignedById,
      createdAt: assignment.createdAt,
    };
  }
}
