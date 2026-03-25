import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import type { ConfigType } from '@nestjs/config';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { r2Config } from '../config/r2.config';
import { FileUpload, UploadPurpose } from './entities/file-upload.entity';
import { PresignDto } from './dto/presign.dto';

const MIME_WHITELIST: Record<UploadPurpose, string[]> = {
  [UploadPurpose.KYC]: ['image/jpeg', 'image/png', 'application/pdf'],
  [UploadPurpose.MERCHANT_LOGO]: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  [UploadPurpose.REPORT]: ['application/pdf', 'text/csv'],
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export const UPLOAD_QUEUE = 'uploads';
export const CLEANUP_JOB = 'cleanup-unconfirmed';

@Injectable()
export class UploadService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(FileUpload)
    private readonly repo: Repository<FileUpload>,

    @Inject(r2Config.KEY)
    private readonly cfg: ConfigType<typeof r2Config>,
  ) {
    this.bucket = cfg.bucketName;
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }

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
    const key = `${dto.purpose}/${userId}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.mimeType,
      ContentLength: dto.sizeBytes,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 900 });

    await this.repo.save(
      this.repo.create({
        userId,
        key,
        bucket: this.bucket,
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

    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
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
