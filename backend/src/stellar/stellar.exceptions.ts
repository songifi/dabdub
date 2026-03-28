import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { StellarSubmitErrorDetails } from './stellar.types';

export class AccountNotFundedException extends BadRequestException {
  constructor() {
    super('Account needs XLM to create trust line');
  }
}

export class AccountNotFoundException extends NotFoundException {
  constructor(public readonly publicKey: string) {
    super(`Stellar account not found for ${publicKey}`);
  }
}

export class StellarSubmitException extends BadRequestException {
  constructor(public readonly details: StellarSubmitErrorDetails) {
    super({
      message: 'Stellar transaction submission failed',
      ...details,
    });
  }
}
