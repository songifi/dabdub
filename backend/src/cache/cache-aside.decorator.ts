import { SetMetadata } from '@nestjs/common';
import { CacheTtlStrategy } from './cache-ttl.config';

export const CACHE_ASIDE_KEY = 'cache:aside';

export interface CacheAsideOptions {
  key?: string | ((args: any[]) => string);
  ttl?: number;
  strategy?: CacheTtlStrategy;
  namespace?: string;
}

/**
 * Decorator to enable cache-aside pattern on methods
 *
 * @example
 * @CacheAside({ key: (args) => `user:${args[0]}`, strategy: 'USER_PROFILE' })
 * async getUser(id: string) { ... }
 */
export const CacheAside = (options: CacheAsideOptions = {}) =>
  SetMetadata(CACHE_ASIDE_KEY, options);
