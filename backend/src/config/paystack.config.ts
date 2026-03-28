import { registerAs } from '@nestjs/config';

export interface PaystackConfig {
  secretKey: string;
  baseUrl: string;
}

export const paystackConfig = registerAs(
  'paystack',
  (): PaystackConfig => ({
    secretKey: process.env['PAYSTACK_SECRET_KEY']!,
    baseUrl: process.env['PAYSTACK_BASE_URL'] ?? 'https://api.paystack.co',
  }),
);
