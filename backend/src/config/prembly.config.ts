import { registerAs } from '@nestjs/config';

export interface PremblyConfig {
  apiKey: string;
  appId: string;
  baseUrl: string;
}

export const premblyConfig = registerAs(
  'prembly',
  (): PremblyConfig => ({
    apiKey: process.env['PREMBLY_API_KEY']!,
    appId: process.env['PREMBLY_APP_ID']!,
    baseUrl:
      process.env['PREMBLY_BASE_URL'] ??
      'https://api.prembly.com/identitypass/verification',
  }),
);
