import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../../notifications/notification.service';
import { WALLET_PROVISIONED_EVENT } from '../blockchain-wallet.service';

@Injectable()
export class WalletProvisionedListener {
  private readonly logger = new Logger(WalletProvisionedListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent(WALLET_PROVISIONED_EVENT)
  async handle(payload: { userId: string; stellarAddress: string }): Promise<void> {
    try {
      await this.notificationService.create(
        payload.userId,
        'wallet.provisioned',
        `Your Stellar wallet is ready. Address: ${payload.stellarAddress}`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to send wallet provisioned notification: ${err.message}`);
    }
  }
}
