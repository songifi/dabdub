import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { SOROBAN_RPC_CLIENT, SorobanService } from './soroban.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SOROBAN_RPC_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const rpcUrl = configService.get<string>('SOROBAN_RPC_URL');
        if (!rpcUrl) {
          throw new Error('SOROBAN_RPC_URL is not configured');
        }

        return new StellarSdk.rpc.Server(rpcUrl);
      },
    },
    SorobanService,
  ],
  exports: [SorobanService],
})
export class SorobanModule {}
