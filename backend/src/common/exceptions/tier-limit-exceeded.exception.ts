import { HttpException, HttpStatus } from '@nestjs/common';

export class TierLimitExceededException extends HttpException {
  constructor(data: { limit: string; used: string; requested: string }) {
    super(
      {
        message: 'Tier transfer limit exceeded',
        error: 'TierLimitExceeded',
        ...data,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
