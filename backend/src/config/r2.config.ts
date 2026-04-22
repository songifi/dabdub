import { registerAs } from '@nestjs/config';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export const r2Config = registerAs(
  'r2',
  (): R2Config => ({
    accountId: process.env['R2_ACCOUNT_ID']!,
    accessKeyId: process.env['R2_ACCESS_KEY_ID']!,
    secretAccessKey: process.env['R2_SECRET_ACCESS_KEY']!,
    bucketName: process.env['R2_BUCKET_NAME']!,
  }),
);
