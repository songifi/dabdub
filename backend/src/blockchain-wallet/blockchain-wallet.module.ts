import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BlockchainWallet } from './entities/blockchain-wallet.entity';
import { SlippageConfig } from './entities/slippage-config.entity';
import { BlockchainWalletService } from './blockchain-wallet.service';
import { SlippageService } from './slippage.service';
import { WalletController } from './wallet.controller';
import { InternalWalletController } from './internal-wallet.controller';
import { SlippageAdminController } from './slippage-admin.controller';
import { WalletProvisionedListener } from './listeners/wallet-provisioned.listener';
import { NotificationsModule } from '../notifications/notifications.module';
import { SorobanModule } from '../soroban/soroban.module';
import { EncryptionService } from '../security/encryption.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([BlockchainWallet, SlippageConfig]),
    NotificationsModule,
    SorobanModule,
  ],
  providers: [
    EncryptionService,
    BlockchainWalletService,
    SlippageService,
    WalletProvisionedListener,
  ],
  controllers: [WalletController, InternalWalletController, SlippageAdminController],
  exports: [BlockchainWalletService, SlippageService],
})
export class BlockchainWalletModule {}
