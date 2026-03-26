import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EmailLog } from './entities/email-log.entity';
import { EmailService, EMAIL_QUEUE, EmailJobPayload } from './email.service';
import { EmailProcessor } from './email.processor';
import { ZeptoMailService } from './zepto-mail.service';
import { EmailAdminController } from './email-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailLog]),
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
      settings: {
        // Custom backoff: delegate to EmailService.getBackoffDelay
        backoffStrategies: {
          custom: (attemptsMade: number, _err: Error, _job: { data: EmailJobPayload }) => {
            const delays = [30_000, 120_000, 600_000];
            return delays[attemptsMade] ?? delays[delays.length - 1];
          },
        },
      },
    }),
  ],
  providers: [EmailService, EmailProcessor, ZeptoMailService],
  controllers: [EmailAdminController],
  exports: [EmailService],
})
export class EmailModule {}
