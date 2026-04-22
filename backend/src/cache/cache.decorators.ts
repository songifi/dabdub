import { Inject } from '@nestjs/common';
import { CacheService } from './cache.service';

export function Cacheable(ttl: number, keyFn: (...args: unknown[]) => string) {
  const injectCache = Inject(CacheService);

  return (target: object, propertyKey: string, descriptor: PropertyDescriptor) => {
    injectCache(target, '_cacheService');

    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      const cache: CacheService = (this as Record<string, unknown>)['_cacheService'] as CacheService;
      const key = keyFn(...args);
      const cached = await cache.get(key);
      if (cached !== null) return cached;
      const result = await original.apply(this, args);
      await cache.set(key, result, ttl);
      return result;
    };

    return descriptor;
  };
}

export function CacheEvict(keyFn: (...args: unknown[]) => string) {
  const injectCache = Inject(CacheService);

  return (target: object, propertyKey: string, descriptor: PropertyDescriptor) => {
    injectCache(target, '_cacheService');

    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      const result = await original.apply(this, args);
      const cache: CacheService = (this as Record<string, unknown>)['_cacheService'] as CacheService;
      await cache.del(keyFn(...args));
      return result;
    };

    return descriptor;
  };
}
