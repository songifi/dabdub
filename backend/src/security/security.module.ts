import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { MerchantIpAllowlist } from './entities/merchant-ip-allowlist.entity';
import { SecurityEvent } from './entities/security-event.entity';
import { IpBlock } from './entities/ip-block.entity';
import { Merchant } from '../database/entities/merchant.entity';
import { IpBlockService } from './services/ip-block.service';
import { IpAllowlistService } from './services/ip-allowlist.service';
import { SecurityEventService } from './services/security-event.service';
import { IpExpiryProcessor } from './processors/ip-expiry.processor';
import { MerchantIpAllowlistController } from './controllers/merchant-ip-allowlist.controller';
import { SecurityController } from './controllers/security.controller';
import { RedisModule } from '../common/redis';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MerchantIpAllowlist,
      SecurityEvent,
      IpBlock,
      Merchant,
    ]),
    BullModule.registerQueue({
      name: 'ip-expiry',
    }),
    RedisModule,
  ],
  providers: [
    IpBlockService,
    IpAllowlistService,
    SecurityEventService,
    IpExpiryProcessor,
  ],
  controllers: [
    MerchantIpAllowlistController,
    SecurityController,
  ],
  exports: [
    IpBlockService,
    IpAllowlistService,
    SecurityEventService,
  ],
})
export class SecurityModule {}
