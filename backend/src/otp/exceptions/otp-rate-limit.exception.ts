import { HttpException, HttpStatus } from '@nestjs/common';

export class OtpRateLimitException extends HttpException {
  constructor() {
    super(
      'Too many OTP requests. Please wait 10 minutes before trying again',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
