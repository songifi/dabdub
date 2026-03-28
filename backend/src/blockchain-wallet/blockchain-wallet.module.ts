import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BlockchainWallet } from './entities/blockchain-wallet.entity';
import { BlockchainWalletService } from './blockchain-wallet.service';
import { SorobanService } from './soroban.service';
import { WalletController } from './wallet.controller';
import { InternalWalletController } from './internal-wallet.controller';
import { WalletProvisionedListener } from './listeners/wallet-provisioned.listener';
import { NotificationModule } from '../notification/notification.module';
import { UserEntity } from '../database/entities/user.entity';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([BlockchainWallet, UserEntity]),
    NotificationModule,
    StellarModule,
  ],
  providers: [BlockchainWalletService, SorobanService, WalletProvisionedListener],
  controllers: [WalletController, InternalWalletController],
  exports: [BlockchainWalletService],
})
export class BlockchainWalletModule {}
