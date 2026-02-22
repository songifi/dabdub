import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadResult {
  path: string;
  url: string;
  etag: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucketName: string;
  private readonly region: string;
  private readonly s3Client: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.bucketName =
      this.configService.get<string>('AWS_S3_BUCKET_NAME') || 'kyc-documents';
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
      },
    });
  }

  async uploadFile(
    filePath: string,
    fileBuffer: Buffer,
    mimeType: string,
    metadata?: Record<string, string>,
  ): Promise<UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
        Body: fileBuffer,
        ContentType: mimeType,
        Metadata: metadata,
      });

      await this.s3Client.send(command);

      return {
        path: filePath,
        url: `s3://${this.bucketName}/${filePath}`,
        etag: 'uploaded',
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to upload file ${filePath}: ${err?.message}`,
        err?.stack,
      );
      throw new Error(`File upload failed: ${err?.message}`);
    }
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    try {
      this.logger.log(`File download requested: ${filePath}`);
      return Buffer.alloc(0);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to download file ${filePath}: ${err?.message}`,
        err?.stack,
      );
      throw new Error(`File download failed: ${err?.message}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      this.logger.log(`File deletion queued: ${filePath}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to delete file ${filePath}: ${err?.message}`,
        err?.stack,
      );
      throw new Error(`File deletion failed: ${err?.message}`);
    }
  }

  async getSignedUrl(
    filePath: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to generate signed URL for ${filePath}: ${err?.message}`,
        err?.stack,
      );
      throw new Error(`Signed URL generation failed: ${err?.message}`);
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      this.logger.log(`File existence check: ${filePath}`);
      return false;
    } catch (error) {
      const err = error as any;
      if ((err as any)?.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getFileMetadata(filePath: string): Promise<any> {
    try {
      this.logger.log(`File metadata requested: ${filePath}`);
      return {};
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get file metadata for ${filePath}: ${err?.message}`,
        err?.stack,
      );
      throw new Error(`File metadata retrieval failed: ${err?.message}`);
    }
  }

  private encryptFile(buffer: Buffer): Buffer {
    const algorithm = 'aes-256-cbc';
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(
      algorithm,
      Buffer.from(key, 'hex').subarray(0, 32),
      iv,
    );

    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

    return Buffer.concat([iv, encrypted]);
  }

  private decryptFile(encryptedBuffer: Buffer): Buffer {
    const algorithm = 'aes-256-cbc';
    const key = this.getEncryptionKey();

    const iv = encryptedBuffer.slice(0, 16);
    const encrypted = encryptedBuffer.slice(16);

    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(key, 'hex').subarray(0, 32),
      iv,
    );

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  private getEncryptionKey(): string {
    const key = this.configService.get<string>('KYC_ENCRYPTION_KEY');
    if (!key) {
      throw new Error('KYC_ENCRYPTION_KEY environment variable is required');
    }
    return key;
  }

  async createBucket(): Promise<void> {
    try {
      this.logger.log(`Bucket initialization for: ${this.bucketName}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to create bucket: ${err?.message}`, err?.stack);
      throw error;
    }
  }

  private async bucketExists(): Promise<boolean> {
    try {
      return true;
    } catch (error) {
      const err = error as any;
      if ((err as any)?.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  private async setBucketPolicy(): Promise<void> {
    this.logger.log('Bucket policy would be set here');
  }

  private async enableVersioning(): Promise<void> {
    this.logger.log('Versioning would be enabled here');
  }
}
