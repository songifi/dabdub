import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { SmsModule } from '../sms/sms.module';
import { PinController } from './pin.controller';
import { PinGuard } from './guards/pin.guard';
import { OtpService } from './otp.service';
import { PinService } from './pin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), SmsModule],
  controllers: [PinController],
  providers: [PinService, OtpService, PinGuard],
  exports: [PinService, PinGuard],
})
export class PinModule {}
