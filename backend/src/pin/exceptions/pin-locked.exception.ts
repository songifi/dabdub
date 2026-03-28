import { HttpException, HttpStatus } from '@nestjs/common';

export class PinLockedException extends HttpException {
  constructor(lockExpiresAt: string) {
    super(
      {
        message: 'PIN verification temporarily locked after too many failed attempts.',
        error: 'PinLocked',
        lockExpiresAt,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
