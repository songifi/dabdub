import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { VirtualAccountModule } from '../virtual-account/virtual-account.module';
import { PayLinkModule } from '../paylink/paylink.module';
import { ReceiveController } from './receive.controller';
import { ReceiveService } from './receive.service';

@Module({
  imports: [CacheModule, VirtualAccountModule, PayLinkModule],
  controllers: [ReceiveController],
  providers: [ReceiveService],
})
export class ReceiveModule {}
