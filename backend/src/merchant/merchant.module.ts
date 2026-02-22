import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantController } from './controllers/merchant.controller';
import { MerchantFeeController } from './controllers/merchant-fee.controller';
import { MerchantService } from './services/merchant.service';
import { MerchantFeeService } from './services/merchant-fee.service';
import { Merchant } from '../database/entities/merchant.entity';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MerchantJwtStrategy } from './strategies/merchant-jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { MerchantAuditLog } from './entities/merchant-audit-log.entity';
import { MerchantNote } from './entities/merchant-note.entity';
import { ApiKey } from '../api-key/entities/api-key.entity';
import { MerchantFeeConfig } from './entities/merchant-fee-config.entity';
import { PlatformFeeDefault } from './entities/platform-fee-default.entity';
import { UserEntity } from '../database/entities/user.entity';
import { PlatformFeeAuditLog } from './entities/platform-fee-audit-log.entity';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { RedisModule } from '../common/redis';

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
    ]),


    AuthModule, // Assuming we might need auth services like PasswordService if exported, or we replicate logic
    ConfigModule,
    RedisModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRATION') ||
            '1d') as any,
          algorithm: 'HS256',
        },
      }),
    }),
  ],
  controllers: [MerchantController, MerchantFeeController],
  providers: [MerchantService, MerchantFeeService, MerchantJwtStrategy, SuperAdminGuard],
  exports: [MerchantService, MerchantFeeService],
})
export class MerchantModule { }
