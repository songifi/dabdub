import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { stellarConfig } from '../config/stellar.config';
import { StellarService } from './stellar.service';
import { StellarAssetService } from './stellar-asset.service';

@Module({
  imports: [ConfigModule.forFeature(stellarConfig)],
  providers: [StellarService, StellarAssetService],
  exports: [StellarService, StellarAssetService],
})
export class StellarModule {}
