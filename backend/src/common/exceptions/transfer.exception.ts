import { AppException } from './app.exception';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../constants/error-codes.constant';

export class TransferException {
  static insufficientBalance(available: number, requested: number) {
    return new AppException({
      code: ERROR_CODES.TRANSFER_INSUFFICIENT_BALANCE,
      message: 'Insufficient balance for this transfer',
      statusCode: HttpStatus.BAD_REQUEST,
      details: { available, requested },
    });
  }
}