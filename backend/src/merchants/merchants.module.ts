import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';
import { AdminMerchantsController } from './admin-merchants.controller';
import { Merchant } from './entities/merchant.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Merchant, AdminAuditLog])],
  controllers: [MerchantsController, AdminMerchantsController],
  providers: [MerchantsService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
