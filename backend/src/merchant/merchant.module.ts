import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantController } from './controllers/merchant.controller';
import { MerchantFeeController } from './controllers/merchant-fee.controller';
import { MerchantService } from './services/merchant.service';
import { MerchantFeeService } from './services/merchant-fee.service';
import { MerchantLifecycleController } from './controllers/merchant-lifecycle.controller';
import { MerchantLifecycleService } from './services/merchant-lifecycle.service';
import { MerchantLifecycleProcessor } from './processors/merchant-lifecycle.processor';
import { Merchant } from '../database/entities/merchant.entity';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MerchantJwtStrategy } from './strategies/merchant-jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { MerchantAuditLog } from './entities/merchant-audit-log.entity';
import { MerchantNote } from './entities/merchant-note.entity';
import { MerchantFeeConfig } from './entities/merchant-fee-config.entity';
import { PlatformFeeDefault } from './entities/platform-fee-default.entity';
import { PlatformFeeAuditLog } from './entities/platform-fee-audit-log.entity';
import { MerchantSuspension } from './entities/merchant-suspension.entity';
import { MerchantTermination } from './entities/merchant-termination.entity';
import { MerchantFlag } from './entities/merchant-flag.entity';
import { ApiKey } from '../api-key/entities/api-key.entity';
import { UserEntity } from '../database/entities/user.entity';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { GlobalConfigService } from '../config/global-config.service';
import { BullModule } from '@nestjs/bullmq';



@Module({
  imports: [
    TypeOrmModule.forFeature([
      Merchant,
      MerchantAuditLog,
      MerchantNote,
      ApiKey,
      MerchantFeeConfig,
      PlatformFeeDefault,
      PlatformFeeAuditLog,
      UserEntity,
      MerchantSuspension,
      MerchantTermination,
      MerchantFlag,
    ]),
    BullModule.registerQueue(
      { name: 'settlements' },
      { name: 'notifications' },
    ),
    AuthModule,
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [GlobalConfigService],
      useFactory: async (configService: GlobalConfigService) => ({
        secret: configService.getJwtSecret(),
      }),
    }),
  ],
  controllers: [MerchantController, MerchantFeeController, MerchantLifecycleController],
  providers: [
    MerchantService,
    MerchantFeeService,
    MerchantJwtStrategy,
    SuperAdminGuard,
    MerchantLifecycleService,
    MerchantLifecycleProcessor,
  ],
  exports: [MerchantService, MerchantFeeService, MerchantLifecycleService],
})
export class MerchantModule { }
