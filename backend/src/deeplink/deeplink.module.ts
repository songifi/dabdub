import { Module } from '@nestjs/common';
import { DeepLinkService } from './deeplink.service';
import { DeepLinkController } from './deeplink.controller';

@Module({
  providers: [DeepLinkService],
  controllers: [DeepLinkController],
  exports: [DeepLinkService],
})
export class DeepLinkModule {}
