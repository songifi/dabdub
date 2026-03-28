import { registerAs } from '@nestjs/config';

export interface SudoAfricaConfig {
  apiKey: string;
  baseUrl: string;
  webhookSecret: string;
}

export const sudoAfricaConfig = registerAs(
  'sudoAfrica',
  (): SudoAfricaConfig => ({
    apiKey: process.env['SUDO_AFRICA_API_KEY']!,
    baseUrl:
      process.env['SUDO_AFRICA_BASE_URL'] ??
      'https://api.sudoafrica.com/v1',
    webhookSecret: process.env['SUDO_AFRICA_WEBHOOK_SECRET']!,
  }),
);
