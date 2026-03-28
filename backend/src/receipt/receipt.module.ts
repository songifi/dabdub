import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { r2Config } from '../config/r2.config';
import { Transaction } from '../transactions/entities/transaction.entity';
import { PayLink } from '../paylink/entities/pay-link.entity';
import { User } from '../users/entities/user.entity';
import { Merchant } from '../merchants/entities/merchant.entity';
import { EmailModule } from '../email/email.module';
import { ReceiptService } from './receipt.service';
import { ReceiptController } from './receipt.controller';

@Module({
  imports: [
    ConfigModule.forFeature(r2Config),
    TypeOrmModule.forFeature([Transaction, PayLink, User, Merchant]),
    EmailModule,
  ],
  providers: [ReceiptService],
  controllers: [ReceiptController],
  exports: [ReceiptService],
})
export class ReceiptModule {}
