import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import { TypeOrmModule } from '@nestjs/typeorm';
import { redisConfig } from '../config';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { UsersModule } from '../users/users.module';
import { OtpController } from './otp.controller';
import { Otp } from './entities/otp.entity';
import { OtpService, OTP_REDIS } from './otp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Otp]),
    EmailModule,
    SmsModule,
    UsersModule,
  ],
  controllers: [OtpController],
  providers: [
    OtpService,
    {
      provide: OTP_REDIS,
      inject: [redisConfig.KEY],
      useFactory: (redis: ConfigType<typeof redisConfig>) =>
        new Redis({
          host: redis.host,
          port: redis.port,
          password: redis.password,
        }),
    },
  ],
  exports: [OtpService],
})
export class OtpModule {}
