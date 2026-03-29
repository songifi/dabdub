import { AppException } from './app.exception';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../constants/error-codes.constant';

export class PaylinkException {
  static invalidCredentials() {
    return new AppException({
      code: ERROR_CODES.PAYLINK_INVALID_CREDENTIALS,
      message: 'Invalid paylink credentials',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}