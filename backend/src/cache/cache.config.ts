import { registerAs } from '@nestjs/config';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  tls?: {
    rejectUnauthorized: boolean;
  };
  cluster?: {
    enabled: boolean;
    nodes: Array<{ host: string; port: number }>;
    options?: {
      redisOptions?: {
        password?: string;
        tls?: {
          rejectUnauthorized: boolean;
        };
      };
    };
  };
  defaultTtl: number;
  maxRetries: number;
  retryDelayOnFailover: number;
  enableReadyCheck: boolean;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
  enableOfflineQueue: boolean;
}

export default registerAs(
  'cache',
  (): CacheConfig => ({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
    tls:
      process.env.REDIS_TLS === 'true'
        ? {
            rejectUnauthorized:
              process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
          }
        : undefined,
    cluster:
      process.env.REDIS_CLUSTER_ENABLED === 'true'
        ? {
            enabled: true,
            nodes: process.env.REDIS_CLUSTER_NODES
              ? process.env.REDIS_CLUSTER_NODES.split(',').map((node) => {
                  const [host, port] = node.trim().split(':');
                  return { host, port: parseInt(port, 10) };
                })
              : [{ host: 'localhost', port: 6379 }],
            options: {
              redisOptions: {
                password: process.env.REDIS_PASSWORD,
                tls:
                  process.env.REDIS_TLS === 'true'
                    ? {
                        rejectUnauthorized:
                          process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
                      }
                    : undefined,
              },
            },
          }
        : {
            enabled: false,
            nodes: [],
          },
    defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '3600', 10), // 1 hour default
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
    enableReadyCheck: process.env.REDIS_ENABLE_READY_CHECK !== 'false',
    maxRetriesPerRequest: parseInt(
      process.env.REDIS_MAX_RETRIES_PER_REQUEST || '3',
      10,
    ),
    lazyConnect: process.env.REDIS_LAZY_CONNECT === 'true',
    enableOfflineQueue: process.env.REDIS_ENABLE_OFFLINE_QUEUE !== 'false',
  }),
);
