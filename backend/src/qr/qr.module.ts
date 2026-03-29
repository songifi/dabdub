import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QrService } from './qr.service';
import { QrController } from './qr.controller';
import { PayLink } from '../paylink/entities/pay-link.entity';
import { DeepLinkModule } from '../deeplink/deeplink.module';

@Module({
  imports: [TypeOrmModule.forFeature([PayLink]), DeepLinkModule],
  providers: [QrService],
  controllers: [QrController],
  exports: [QrService],
})
export class QrModule {}
