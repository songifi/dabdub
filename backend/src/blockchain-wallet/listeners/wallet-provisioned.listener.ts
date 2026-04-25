import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WALLET_PROVISIONED_EVENT } from '../blockchain-wallet.service';

@Injectable()
export class WalletProvisionedListener {
  private readonly logger = new Logger(WalletProvisionedListener.name);

  @OnEvent(WALLET_PROVISIONED_EVENT)
  async handle(payload: { userId: string; stellarAddress: string }) {
    this.logger.log(
      `Wallet provisioned for user ${payload.userId} at ${payload.stellarAddress}`,
    );
  }
}
