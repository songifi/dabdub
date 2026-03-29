import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { stellarConfig } from '../config/stellar.config';
import { StellarService } from './stellar.service';
import { StellarAssetService } from './stellar-asset.service';
import { StellarAdminController } from './stellar-admin.controller';

@Module({
  imports: [ConfigModule.forFeature(stellarConfig)],
  providers: [StellarService, StellarAssetService],
  controllers: [StellarAdminController],
  exports: [StellarService, StellarAssetService],
})
export class StellarModule {}
