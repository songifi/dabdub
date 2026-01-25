import { Module, Global, DynamicModule, Logger } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import Redis, { Cluster } from 'ioredis';
import cacheConfig from './cache.config';
import { CacheService } from './cache.service';
import { CacheMetricsService } from './cache-metrics.service';
import { CacheWarmingService } from './cache-warming.service';
import { CacheAsideInterceptor } from './cache-aside.interceptor';

@Global()
@Module({})
export class CacheModule {
  static forRoot(): DynamicModule {
    return {
      module: CacheModule,
      imports: [
        ConfigModule.forFeature(cacheConfig),
        NestCacheModule.registerAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => {
            const cacheConfig =
              configService.get<ReturnType<typeof cacheConfig>>('cache');

            if (!cacheConfig) {
              throw new Error('Cache configuration not found');
            }

            const logger = new Logger('CacheModule');

            // Handle Redis cluster configuration
            if (cacheConfig.cluster?.enabled) {
              const cluster = new Cluster(cacheConfig.cluster.nodes, {
                ...cacheConfig.cluster.options,
                maxRetriesPerRequest: cacheConfig.maxRetriesPerRequest,
                enableReadyCheck: cacheConfig.enableReadyCheck,
                enableOfflineQueue: cacheConfig.enableOfflineQueue,
              });

              return {
                store: redisStore,
                host: cacheConfig.cluster.nodes[0]?.host || 'localhost',
                port: cacheConfig.cluster.nodes[0]?.port || 6379,
                ttl: cacheConfig.defaultTtl * 1000, // Convert to milliseconds
                client: cluster,
              };
            }

            // Standard Redis configuration
            const redisClient = new Redis({
              host: cacheConfig.host,
              port: cacheConfig.port,
              password: cacheConfig.password,
              db: cacheConfig.db,
              tls: cacheConfig.tls,
              maxRetries: cacheConfig.maxRetries,
              retryDelayOnFailover: cacheConfig.retryDelayOnFailover,
              enableReadyCheck: cacheConfig.enableReadyCheck,
              maxRetriesPerRequest: cacheConfig.maxRetriesPerRequest,
              lazyConnect: cacheConfig.lazyConnect,
              enableOfflineQueue: cacheConfig.enableOfflineQueue,
            });

            // Handle connection events
            redisClient.on('connect', () => {
              logger.log('Redis client connecting...');
            });

            redisClient.on('ready', () => {
              logger.log('Redis client ready');
            });

            redisClient.on('error', (error) => {
              logger.error('Redis client error:', error);
            });

            redisClient.on('close', () => {
              logger.log('Redis client connection closed');
            });

            return {
              store: redisStore,
              host: cacheConfig.host,
              port: cacheConfig.port,
              password: cacheConfig.password,
              db: cacheConfig.db,
              ttl: cacheConfig.defaultTtl * 1000, // Convert to milliseconds
              client: redisClient,
            };
          },
          inject: [ConfigService],
        }),
      ],
      providers: [
        CacheService,
        CacheMetricsService,
        CacheWarmingService,
        CacheAsideInterceptor,
      ],
      exports: [
        CacheService,
        CacheMetricsService,
        CacheWarmingService,
        CacheAsideInterceptor,
        NestCacheModule,
      ],
    };
  }
}
