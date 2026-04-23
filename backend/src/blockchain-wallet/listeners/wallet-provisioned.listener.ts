import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { NotificationService } from '../../notification/notification.service';
import { NotificationType } from '../../notification/entities/notification.entity';
import { WALLET_PROVISIONED_EVENT } from '../blockchain-wallet.service';

@Injectable()
export class WalletProvisionedListener {
  private readonly logger = new Logger(WalletProvisionedListener.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent(WALLET_PROVISIONED_EVENT)
  async handle(payload: { userId: string; stellarAddress: string }) {
    try {
      const user = await this.userRepo.findOne({ where: { id: payload.userId } });
      if (!user) return;

      await this.notificationService.sendNotification(
        user.id,
        NotificationType.EMAIL,
        user.email,
        `Welcome to CheesePay! Your Stellar wallet has been created.\n\nAddress: ${payload.stellarAddress}`,
        'Your CheesePay wallet is ready',
        { stellarAddress: payload.stellarAddress },
      );
    } catch (err: any) {
      this.logger.error(`Failed to send wallet provisioned notification: ${err.message}`);
    }
  }
}
