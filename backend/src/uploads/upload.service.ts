import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { R2Service } from '../r2/r2.service';
import { FileUpload, UploadPurpose } from './entities/file-upload.entity';
import { PresignDto } from './dto/presign.dto';

const MIME_WHITELIST: Record<UploadPurpose, string[]> = {
  [UploadPurpose.KYC]: ['image/jpeg', 'image/png', 'application/pdf'],
  [UploadPurpose.MERCHANT_LOGO]: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
  ],
  [UploadPurpose.REPORT]: ['application/pdf', 'text/csv'],
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export const UPLOAD_QUEUE = 'uploads';
export const CLEANUP_JOB = 'cleanup-unconfirmed';

@Injectable()
export class UploadService {
  constructor(
    @InjectRepository(FileUpload)
    private readonly repo: Repository<FileUpload>,

    private readonly r2: R2Service,
  ) {}

  async getPresignedUrl(
    userId: string,
    dto: PresignDto,
  ): Promise<{ url: string; key: string }> {
    if (dto.sizeBytes > MAX_SIZE) {
      throw new BadRequestException('File exceeds 10 MB limit');
    }

    const allowed = MIME_WHITELIST[dto.purpose];
    if (!allowed.includes(dto.mimeType)) {
      throw new BadRequestException(
        `mimeType "${dto.mimeType}" is not allowed for purpose "${dto.purpose}"`,
      );
    }

    const ext = dto.mimeType.split('/')[1].replace('+xml', '');
    // Key naming convention enforced here per purpose
    const key = `${dto.purpose}/${userId}/${randomUUID()}.${ext}`;

    const { uploadUrl: url } = await this.r2.getPresignedUploadUrl(key, dto.mimeType, 900);

    await this.repo.save(
      this.repo.create({
        userId,
        key,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        purpose: dto.purpose,
        isConfirmed: false,
      }),
    );

    return { url, key };
  }

  async confirmUpload(userId: string, key: string): Promise<FileUpload> {
    const record = await this.repo.findOne({ where: { key } });
    if (!record) throw new NotFoundException('Upload record not found');

    this.assertOwnership(userId, record);

    const { exists } = await this.r2.headObject(key);
    if (!exists) {
      throw new BadRequestException('File not found in storage');
    }

    record.isConfirmed = true;
    return this.repo.save(record);
  }

  assertOwnership(userId: string, record: FileUpload): void {
    if (record.userId !== userId) {
      throw new ForbiddenException('You do not own this upload');
    }
  }

  async deleteUnconfirmedOlderThan(cutoff: Date): Promise<void> {
    await this.repo.delete({ isConfirmed: false, createdAt: LessThan(cutoff) });
  }
}
