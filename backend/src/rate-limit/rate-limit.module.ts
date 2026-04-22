import { Module } from '@nestjs/common';
import { IpBlockService } from './ip-block.service';
import { RateLimitAdminController } from './rate-limit-admin.controller';

@Module({
  providers: [IpBlockService],
  controllers: [RateLimitAdminController],
  exports: [IpBlockService],
})
export class RateLimitModule {}
