import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { EmailLog } from './entities/email-log.entity';
import { EmailService, EMAIL_QUEUE } from './email.service';
import { EmailProcessor } from './email.processor';
import { NodemailerService } from './nodemailer.service';
import { EmailAdminController } from './email-admin.controller';
import { emailConfig } from '../config/email.config';

@Module({
  imports: [
    ConfigModule.forFeature(emailConfig),
    TypeOrmModule.forFeature([EmailLog]),
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
  ],
  providers: [EmailService, EmailProcessor, NodemailerService],
  controllers: [EmailAdminController],
  exports: [EmailService],
})
export class EmailModule {}
