import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettlementRule } from '../database/entities/settlement-rule.entity';
import { Settlement } from '../settlement/entities/settlement.entity';
import { SettlementConfigService } from './settlement-config.service';
import { SettlementConfigController } from './settlement-config.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SettlementRule, Settlement]),
    AuditModule,
  ],
  providers: [SettlementConfigService],
  controllers: [SettlementConfigController],
  exports: [SettlementConfigService],
})
export class SettlementConfigModule {}
