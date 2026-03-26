import { Module, Global } from '@nestjs/common';
import { RedisModule } from './redis.module';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
