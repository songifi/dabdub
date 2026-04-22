import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QrService } from './qr.service';
import { QrController } from './qr.controller';
import { PayLink } from '../paylink/entities/pay-link.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PayLink])],
  providers: [QrService],
  controllers: [QrController],
  exports: [QrService],
})
export class QrModule {}
