import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '../cache/cache.module';
import { PayLink } from '../paylink/entities/pay-link.entity';
import { PayLinkModule } from '../paylink/paylink.module';
import { User } from '../users/entities/user.entity';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { SandboxApiKeyGuard } from './sandbox-api-key.guard';
import { SandboxController } from './sandbox.controller';
import { SandboxService } from './sandbox.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayLink, User]),
    CacheModule,
    PayLinkModule,
    WebhooksModule,
  ],
  providers: [SandboxService, SandboxApiKeyGuard],
  controllers: [SandboxController],
  exports: [SandboxService],
})
export class SandboxModule {}
