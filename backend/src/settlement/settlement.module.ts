import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Settlement } from './entities/settlement.entity';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module';
import { SettlementHistoryService } from './settlement-history.service';
import { SettlementController } from './settlement.controller';
import { MerchantsModule } from '../merchants/merchants.module';
import { SettlementProcessingService } from './settlement-processing.service';
import { SettlementProcessor } from './processors/settlement.processor';
import { RatesModule } from '../rates/rates.module';
import { QueueModule } from '../queue/queue.module';
import { Merchant } from '../merchants/entities/merchant.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Settlement, Merchant, BankAccount]),
    BankAccountsModule,
    MerchantsModule,
    RatesModule,
    QueueModule,
  ],
  controllers: [SettlementController],
  providers: [
    SettlementHistoryService,
    SettlementProcessingService,
    SettlementProcessor,
  ],
  exports: [SettlementHistoryService, SettlementProcessingService],
})
export class SettlementModule {}
