import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { CronAdminController } from './cron-admin.controller';
import { Merchant } from '../merchants/entities/merchant.entity';
import { Payment } from '../payments/entities/payment.entity';
import { FeeConfig } from '../fee-config/entities/fee-config.entity';
import { FeeHistory } from '../fee-config/entities/fee-history.entity';
import { CronModule } from '../cron/cron.module';
import { AuditLog } from './entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Merchant, Payment, FeeConfig, FeeHistory, AuditLog]), CronModule],
  controllers: [AdminController, CronAdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
