import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Settlement } from './entities/settlement.entity';
import { Merchant } from '../database/entities/merchant.entity';
import { SettlementRepository } from './repositories/settlement.repository';
import { SettlementService } from './settlement.service';
import { SettlementController } from './settlement.controller';
import { MockPartnerService } from './services/mock-partner.service';

@Module({
  imports: [TypeOrmModule.forFeature([Settlement, Merchant])],
  controllers: [SettlementController],
  providers: [
    SettlementRepository,
    SettlementService,
    {
      provide: 'IPartnerService',
      useClass: MockPartnerService,
    },
  ],
  exports: [
    SettlementRepository,
    SettlementService,
    TypeOrmModule,
    'IPartnerService',
  ],
})
export class SettlementModule {}
