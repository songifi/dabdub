import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigManagementController } from './config-management.controller';
import { ConfigManagementService } from './config-management.service';
import { BlockchainConfig } from './entities/blockchain-config.entity';
import { TokenConfig } from './entities/token-config.entity';
import { RedisModule } from '../common/redis';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlockchainConfig, TokenConfig]),
    RedisModule,
  ],
  controllers: [ConfigManagementController],
  providers: [ConfigManagementService],
  exports: [ConfigManagementService],
})
export class ConfigManagementModule {}
