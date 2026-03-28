import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import { SmsLog } from './entities/sms-log.entity';
import { SmsService, SMS_QUEUE, SMS_REDIS } from './sms.service';
import { SmsProcessor } from './sms.processor';
import { TermiiService } from './termii.service';
import { smsConfig } from '../config';
import { redisConfig } from '../config';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmsLog]),
    BullModule.registerQueue({
      name: SMS_QUEUE,
    }),
  ],
  providers: [
    SmsService,
    SmsProcessor,
    TermiiService,
    {
      provide: SMS_REDIS,
      inject: [redisConfig.KEY],
      useFactory: (redis: ConfigType<typeof redisConfig>) =>
        new Redis({
          host: redis.host,
          port: redis.port,
          password: redis.password,
        }),
    },
  ],
  exports: [SmsService],
})
export class SmsModule {}
