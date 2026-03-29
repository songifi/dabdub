import { AppException } from './app.exception';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../constants/error-codes.constant';

export class KYCException {
  static alreadySubmitted() {
    return new AppException({
      code: ERROR_CODES.KYC_ALREADY_SUBMITTED,
      message: 'KYC information has already been submitted',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}           
