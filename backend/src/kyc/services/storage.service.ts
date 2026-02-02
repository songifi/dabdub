import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';

export interface UploadResult {
  path: string;
  url: string;
  etag: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: AWS.S3;
  private readonly bucketName: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || 'kyc-documents';
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';

    // Configure AWS S3
    AWS.config.update({
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      region: this.region,
    });

    this.s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      signatureVersion: 'v4',
    });
  }

  async uploadFile(
    filePath: string,
    fileBuffer: Buffer,
    mimeType: string,
    metadata?: Record<string, string>,
  ): Promise<UploadResult> {
    try {
      // Encrypt file before upload
      const encryptedBuffer = this.encryptFile(fileBuffer);

      const uploadParams: AWS.S3.PutObjectRequest = {
        Bucket: this.bucketName,
        Key: filePath,
        Body: encryptedBuffer,
        ContentType: mimeType,
        ServerSideEncryption: 'AES256',
        StorageClass: 'STANDARD_IA', // Infrequent Access for cost optimization
        Metadata: {
          ...metadata,
          encrypted: 'true',
          originalSize: fileBuffer.length.toString(),
        },
        // Prevent public access
        ACL: 'private',
      };

      const result = await this.s3.upload(uploadParams).promise();

      this.logger.log(`File uploaded successfully: ${filePath}`);

      return {
        path: filePath,
        url: result.Location,
        etag: result.ETag,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file ${filePath}: ${error.message}`, error.stack);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    try {
      const downloadParams: AWS.S3.GetObjectRequest = {
        Bucket: this.bucketName,
        Key: filePath,
      };

      const result = await this.s3.getObject(downloadParams).promise();
      
      if (!result.Body) {
        throw new Error('File not found or empty');
      }

      const encryptedBuffer = result.Body as Buffer;
      
      // Check if file is encrypted
      const isEncrypted = result.Metadata?.encrypted === 'true';
      
      if (isEncrypted) {
        return this.decryptFile(encryptedBuffer);
      }

      return encryptedBuffer;
    } catch (error) {
      this.logger.error(`Failed to download file ${filePath}: ${error.message}`, error.stack);
      throw new Error(`File download failed: ${error.message}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const deleteParams: AWS.S3.DeleteObjectRequest = {
        Bucket: this.bucketName,
        Key: filePath,
      };

      await this.s3.deleteObject(deleteParams).promise();
      
      this.logger.log(`File deleted successfully: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${filePath}: ${error.message}`, error.stack);
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: filePath,
        Expires: expiresIn,
      };

      return this.s3.getSignedUrl('getObject', params);
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${filePath}: ${error.message}`, error.stack);
      throw new Error(`Signed URL generation failed: ${error.message}`);
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const headParams: AWS.S3.HeadObjectRequest = {
        Bucket: this.bucketName,
        Key: filePath,
      };

      await this.s3.headObject(headParams).promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getFileMetadata(filePath: string): Promise<AWS.S3.HeadObjectOutput> {
    try {
      const headParams: AWS.S3.HeadObjectRequest = {
        Bucket: this.bucketName,
        Key: filePath,
      };

      return await this.s3.headObject(headParams).promise();
    } catch (error) {
      this.logger.error(`Failed to get file metadata for ${filePath}: ${error.message}`, error.stack);
      throw new Error(`File metadata retrieval failed: ${error.message}`);
    }
  }

  private encryptFile(buffer: Buffer): Buffer {
    const algorithm = 'aes-256-gcm';
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    
    const encrypted = Buffer.concat([
      cipher.update(buffer),
      cipher.final(),
    ]);

    // Prepend IV to encrypted data
    return Buffer.concat([iv, encrypted]);
  }

  private decryptFile(encryptedBuffer: Buffer): Buffer {
    const algorithm = 'aes-256-gcm';
    const key = this.getEncryptionKey();
    
    // Extract IV from the beginning of the buffer
    const iv = encryptedBuffer.slice(0, 16);
    const encrypted = encryptedBuffer.slice(16);
    
    const decipher = crypto.createDecipher(algorithm, key);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
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
      const bucketExists = await this.bucketExists();
      
      if (!bucketExists) {
        const createParams: AWS.S3.CreateBucketRequest = {
          Bucket: this.bucketName,
          CreateBucketConfiguration: {
            LocationConstraint: this.region,
          },
        };

        await this.s3.createBucket(createParams).promise();
        
        // Set bucket policy to prevent public access
        await this.setBucketPolicy();
        
        // Enable versioning
        await this.enableVersioning();
        
        this.logger.log(`Bucket created successfully: ${this.bucketName}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create bucket: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async bucketExists(): Promise<boolean> {
    try {
      await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  private async setBucketPolicy(): Promise<void> {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'DenyPublicAccess',
          Effect: 'Deny',
          Principal: '*',
          Action: 's3:*',
          Resource: [
            `arn:aws:s3:::${this.bucketName}`,
            `arn:aws:s3:::${this.bucketName}/*`,
          ],
          Condition: {
            Bool: {
              'aws:SecureTransport': 'false',
            },
          },
        },
      ],
    };

    const policyParams: AWS.S3.PutBucketPolicyRequest = {
      Bucket: this.bucketName,
      Policy: JSON.stringify(policy),
    };

    await this.s3.putBucketPolicy(policyParams).promise();
  }

  private async enableVersioning(): Promise<void> {
    const versioningParams: AWS.S3.PutBucketVersioningRequest = {
      Bucket: this.bucketName,
      VersioningConfiguration: {
        Status: 'Enabled',
      },
    };

    await this.s3.putBucketVersioning(versioningParams).promise();
  }
}