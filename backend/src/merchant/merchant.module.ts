import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantController } from './controllers/merchant.controller';
import { MerchantFeeController } from './controllers/merchant-fee.controller';
import { MerchantNoteController } from './controllers/merchant-note.controller';
import {
  MerchantTagController,
  MerchantTagAssignmentController,
} from './controllers/merchant-tag.controller';
import { MerchantFollowUpController } from './controllers/merchant-follow-up.controller';
import { MerchantService } from './services/merchant.service';
import { MerchantFeeService } from './services/merchant-fee.service';
import { MerchantNoteService } from './services/merchant-note.service';
import { MerchantTagService } from './services/merchant-tag.service';
import { MerchantLifecycleController } from './controllers/merchant-lifecycle.controller';
import { MerchantLifecycleService } from './services/merchant-lifecycle.service';
import { MerchantLifecycleProcessor } from './processors/merchant-lifecycle.processor';
import { MerchantDocument } from './entities/merchant-document.entity';
import { DocumentRequest } from './entities/document-request.entity';
import { MerchantDocumentService } from './services/merchant-document.service';
import { DocumentRequestService } from './services/document-request.service';
import { MerchantDocumentController } from './controllers/merchant-document.controller';
import { AdminDocumentController } from './controllers/admin-document.controller';
import { Merchant } from '../database/entities/merchant.entity';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MerchantJwtStrategy } from './strategies/merchant-jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { MerchantAuditLog } from './entities/merchant-audit-log.entity';
import { MerchantNote } from './entities/merchant-note.entity';
import { MerchantTag } from './entities/merchant-tag.entity';
import { MerchantTagAssignment } from './entities/merchant-tag-assignment.entity';
import { ApiKey } from '../api-key/entities/api-key.entity';
import { MerchantFeeConfig } from './entities/merchant-fee-config.entity';
import { PlatformFeeDefault } from './entities/platform-fee-default.entity';
import { UserEntity } from '../database/entities/user.entity';
import { PlatformFeeAuditLog } from './entities/platform-fee-audit-log.entity';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { MerchantSuspension } from './entities/merchant-suspension.entity';
import { MerchantTermination } from './entities/merchant-termination.entity';
import { MerchantFlag } from './entities/merchant-flag.entity';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Merchant,
      MerchantAuditLog,
      MerchantNote,
      MerchantTag,
      MerchantTagAssignment,
      ApiKey,
      MerchantFeeConfig,
      PlatformFeeDefault,
      PlatformFeeAuditLog,
      UserEntity,
      MerchantSuspension,
      MerchantTermination,
      MerchantFlag,
      MerchantDocument,
      DocumentRequest,
    ]),
    BullModule.registerQueue(
      { name: 'settlements' },
      { name: 'notifications' },
    ),
    AuthModule,
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRATION') || '1d') as any,
          algorithm: 'HS256',
        },
      }),
    }),
  ],
  controllers: [
    MerchantController,
    MerchantFeeController,
    MerchantLifecycleController,
    MerchantDocumentController,
    AdminDocumentController,
    MerchantNoteController,
    MerchantTagController,
    MerchantTagAssignmentController,
    MerchantFollowUpController,
  ],
  providers: [
    MerchantService,
    MerchantFeeService,
    MerchantLifecycleService,
    MerchantLifecycleProcessor,
    MerchantNoteService,
    MerchantTagService,
    MerchantJwtStrategy,
    SuperAdminGuard,
    MerchantDocumentService,
    DocumentRequestService,
  ],
  exports: [
    MerchantService,
    MerchantFeeService,
    MerchantLifecycleService,
    MerchantDocumentService,
    DocumentRequestService,
    MerchantNoteService,
    MerchantTagService,
  ],
})
export class MerchantModule {}
