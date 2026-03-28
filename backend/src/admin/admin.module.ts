import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from './entities/admin.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { FraudFlag } from '../fraud/entities/fraud-flag.entity';
import { Session } from '../auth/entities/session.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminAuthModule } from './auth/admin-auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Admin,
      User,
      Transaction,
      FraudFlag,
      Session,
      RefreshToken,
    ]),
    EmailModule,
    NotificationsModule,
    AdminAuthModule,
    AuditModule,
  ],
  providers: [AdminService],
  controllers: [AdminController],
  exports: [AdminService, AdminAuthModule],
})
export class AdminModule {}
