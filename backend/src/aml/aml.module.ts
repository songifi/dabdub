import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AmlFlag } from './entities/aml-flag.entity';
import { AmlService } from './aml.service';
import { AmlController } from './aml.controller';
import { Payment } from '../payments/entities/payment.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([AmlFlag, Payment]), ConfigModule, NotificationsModule],
  providers: [AmlService],
  controllers: [AmlController],
  exports: [AmlService],
})
export class AmlModule {}
