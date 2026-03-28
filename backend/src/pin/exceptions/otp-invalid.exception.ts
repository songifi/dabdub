import { HttpException, HttpStatus } from '@nestjs/common';

export class OtpInvalidException extends HttpException {
  constructor() {
    super(
      { message: 'Invalid or expired verification code', error: 'OtpInvalid' },
      HttpStatus.BAD_REQUEST,
    );
  }
}
