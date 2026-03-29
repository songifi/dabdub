import { NotFoundException } from '@nestjs/common';
import { FeeType } from '../../fee-config/entities/fee-config.entity';

export class NoFeeConfigException extends NotFoundException {
  constructor(type: FeeType) {
    super(`No active fee config found for type: ${type}`);
  }
}
