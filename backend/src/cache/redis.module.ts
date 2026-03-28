import { Module, Global, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import { redisConfig } from '../config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [redisConfig.KEY],
      useFactory: (cfg: ConfigType<typeof redisConfig>): Redis => {
        const logger = new Logger('RedisModule');
        const client = new Redis({
          host: cfg.host,
          port: cfg.port,
          password: cfg.password,
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        });
        client.on('error', (err: Error) =>
          logger.error(`Redis connection error: ${err.message}`),
        );
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
