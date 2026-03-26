import { HttpException, HttpStatus } from '@nestjs/common';

export class SmsRateLimitException extends HttpException {
  constructor(phone: string) {
    super(
      `SMS rate limit exceeded for ${phone}. Max 5 messages per hour.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
