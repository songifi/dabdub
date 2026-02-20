import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CacheModule } from "@nestjs/cache-manager";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { BlockchainConfig } from "./entities/blockchain-config.entity";
import { TokenConfig } from "./entities/token-config.entity";
import { AuditLog } from "./entities/audit-log.entity";
import { BlockchainConfigController } from "./controllers/blockchain-config.controller";
import { TokenConfigController } from "./controllers/token-config.controller";
import { BlockchainConfigService } from "./services/blockchain-config.service";
import { TokenConfigService } from "./services/token-config.service";
import { AuditService } from "./services/audit.service";
import { CacheService } from "./services/cache.service";
import { EventService } from "./services/event.service";
import { EncryptionService } from "./services/encryption.service";
import { RpcService } from "./services/rpc.service";
import { config } from "../config";

@Module({
  imports: [
    TypeOrmModule.forFeature([BlockchainConfig, TokenConfig, AuditLog]),
    CacheModule.register({
      ttl: config.cache.ttl,
      max: 1000,
    }),
    EventEmitterModule.forRoot(),
  ],
  controllers: [BlockchainConfigController, TokenConfigController],
  providers: [
    BlockchainConfigService,
    TokenConfigService,
    AuditService,
    CacheService,
    EventService,
    EncryptionService,
    RpcService,
  ],
  exports: [
    BlockchainConfigService,
    TokenConfigService,
    AuditService,
    CacheService,
    EventService,
    EncryptionService,
    RpcService,
  ],
})
export class ConfigModule {}
