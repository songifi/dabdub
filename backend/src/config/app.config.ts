import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  apiPrefix: string;
  throttleTtl: number;
  throttleLimit: number;
  frontendUrl: string;
}

export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    port: parseInt(process.env['PORT']!, 10),
    nodeEnv: process.env['NODE_ENV'] as AppConfig['nodeEnv'],
    apiPrefix: process.env['API_PREFIX']!,
    throttleTtl: parseInt(process.env['THROTTLE_TTL']!, 10),
    throttleLimit: parseInt(process.env['THROTTLE_LIMIT']!, 10),
    frontendUrl: process.env['FRONTEND_URL']!,
  }),
);
