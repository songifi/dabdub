import { AppException } from './app.exception';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../constants/error-codes.constant';

export class AuthException {
  static invalidCredentials() {
    return new AppException({
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      message: 'Invalid email or password',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}