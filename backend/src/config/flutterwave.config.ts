import { registerAs } from '@nestjs/config';

export interface FlutterwaveConfig {
  secretKey: string;
  webhookSecret: string;
  baseUrl: string;
}

export const flutterwaveConfig = registerAs(
  'flutterwave',
  (): FlutterwaveConfig => ({
    secretKey: process.env['FLUTTERWAVE_SECRET_KEY']!,
    webhookSecret: process.env['FLUTTERWAVE_WEBHOOK_SECRET']!,
    baseUrl: process.env['FLUTTERWAVE_BASE_URL'] ?? 'https://api.flutterwave.com',
  }),
);
