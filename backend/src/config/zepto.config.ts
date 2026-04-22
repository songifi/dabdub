import { registerAs } from '@nestjs/config';

export interface ZeptoConfig {
  apiKey: string;
  fromEmail: string;
}

export const zeptoConfig = registerAs(
  'zepto',
  (): ZeptoConfig => ({
    apiKey: process.env['ZEPTOMAIL_API_KEY']!,
    fromEmail: process.env['ZEPTOMAIL_FROM_EMAIL']!,
  }),
);
