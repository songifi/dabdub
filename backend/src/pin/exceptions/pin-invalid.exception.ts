import { HttpException, HttpStatus } from '@nestjs/common';

export class PinInvalidException extends HttpException {
  constructor() {
    super(
      { message: 'Invalid transaction PIN', error: 'PinInvalid' },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
