import { BadRequestException } from '@nestjs/common';

export class OtpInvalidException extends BadRequestException {
  constructor() {
    super('OTP is invalid, expired, or already used');
  }
}
