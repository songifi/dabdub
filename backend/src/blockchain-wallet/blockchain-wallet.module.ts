import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BlockchainWallet } from './entities/blockchain-wallet.entity';
import { SlippageConfig } from './entities/slippage-config.entity';
import { BlockchainWalletService } from './blockchain-wallet.service';
import { SorobanService } from './soroban.service';
import { SlippageService } from './slippage.service';
import { WalletController } from './wallet.controller';
import { InternalWalletController } from './internal-wallet.controller';
import { SlippageAdminController } from './slippage-admin.controller';
import { WalletProvisionedListener } from './listeners/wallet-provisioned.listener';
import { NotificationModule } from '../notification/notification.module';
import { UserEntity } from '../database/entities/user.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([BlockchainWallet, UserEntity, SlippageConfig]),
    NotificationModule,
  ],
  providers: [BlockchainWalletService, SorobanService, SlippageService, WalletProvisionedListener],
  controllers: [WalletController, InternalWalletController, SlippageAdminController],
  exports: [BlockchainWalletService, SlippageService],
})
export class BlockchainWalletModule {}
