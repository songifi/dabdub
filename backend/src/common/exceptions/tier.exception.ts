import { AppException } from './app.exception';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../constants/error-codes.constant';

export class TierException {
  static invalidTier() {
    return new AppException({
      code: ERROR_CODES.TIER_INVALID,
      message: 'Invalid tier',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}