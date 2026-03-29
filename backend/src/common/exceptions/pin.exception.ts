import { AppException } from './app.exception';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../constants/error-codes.constant';

export class PinException {
  static invalidPin() {
    return new AppException({
      code: ERROR_CODES.PIN_INVALID,
      message: 'Invalid PIN',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}