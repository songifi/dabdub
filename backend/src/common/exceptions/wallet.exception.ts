import { AppException } from './app.exception';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../constants/error-codes.constant';

export class WalletException {
  static invalidCredentials() {
    return new AppException({
      code: ERROR_CODES.WALLET_INVALID_CREDENTIALS,
      message: 'Invalid wallet credentials',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}