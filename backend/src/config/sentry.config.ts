import { registerAs } from '@nestjs/config';

export interface SentryConfig {
  dsn: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
  environment: string;
  enabled: boolean;
}

export const sentryConfig = registerAs(
  'sentry',
  (): SentryConfig => ({
    dsn: process.env['SENTRY_DSN'] ?? '',
    tracesSampleRate: parseFloat(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1'),
    profilesSampleRate: parseFloat(process.env['SENTRY_PROFILES_SAMPLE_RATE'] ?? '0.05'),
    environment: process.env['NODE_ENV'] ?? 'development',
    enabled: !!process.env['SENTRY_DSN'] && process.env['NODE_ENV'] !== 'test',
  }),
);
