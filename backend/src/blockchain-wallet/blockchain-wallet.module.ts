import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BlockchainWallet } from './entities/blockchain-wallet.entity';
import { BlockchainWalletService } from './blockchain-wallet.service';
import { SorobanService } from './soroban.service';
import { WalletController } from './wallet.controller';
import { InternalWalletController } from './internal-wallet.controller';
import { WalletProvisionedListener } from './listeners/wallet-provisioned.listener';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([BlockchainWallet]),
    NotificationsModule,
  ],
  providers: [BlockchainWalletService, SorobanService, WalletProvisionedListener],
  controllers: [WalletController, InternalWalletController],
  exports: [BlockchainWalletService],
})
export class BlockchainWalletModule {}
