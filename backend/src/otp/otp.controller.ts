import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpType } from './entities/otp.entity';
import { OtpService } from './otp.service';

type AuthenticatedRequest = Request & { user: User };

@ApiTags('otp')
@ApiBearerAuth()
@Controller('otp')
export class OtpController {
  constructor(
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly usersService: UsersService,
  ) {}

  @Post('send-email')
  @ApiOperation({ summary: 'Send an OTP for email verification' })
  async sendEmail(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    const code = await this.otpService.generate(
      req.user.id,
      OtpType.EMAIL_VERIFY,
      req.ip ?? 'unknown',
    );

    await this.emailService.queue(
      req.user.email,
      'OTP_EMAIL_VERIFY',
      { code },
      req.user.id,
    );

    return { message: 'OTP sent to your email' };
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify an email OTP for the authenticated user' })
  async verifyEmail(
    @Req() req: AuthenticatedRequest,
    @Body() dto: VerifyOtpDto,
  ): Promise<{ message: string }> {
    await this.otpService.verify(req.user.id, OtpType.EMAIL_VERIFY, dto.code);
    await this.usersService.markEmailVerified(req.user.id);
    return { message: 'Email verified successfully' };
  }

  @Post('send-phone')
  @ApiOperation({ summary: 'Send an OTP for phone verification' })
  async sendPhone(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    if (!req.user.phone) {
      throw new BadRequestException('Phone number is not set');
    }

    const code = await this.otpService.generate(
      req.user.id,
      OtpType.PHONE_VERIFY,
      req.ip ?? 'unknown',
    );

    await this.smsService.sendOtp(req.user.phone, code, req.user.id);
    return { message: 'OTP sent to your phone' };
  }

  @Post('verify-phone')
  @ApiOperation({ summary: 'Verify a phone OTP for the authenticated user' })
  async verifyPhone(
    @Req() req: AuthenticatedRequest,
    @Body() dto: VerifyOtpDto,
  ): Promise<{ message: string }> {
    await this.otpService.verify(req.user.id, OtpType.PHONE_VERIFY, dto.code);
    await this.usersService.markPhoneVerified(req.user.id);
    return { message: 'Phone verified successfully' };
  }
}
