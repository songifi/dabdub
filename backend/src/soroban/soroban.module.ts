import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { SorobanService } from './soroban.service';
import { ContractEventListenerService } from './services/contract-event-listener.service';
import { SorobanAdminController } from './controllers/soroban-admin.controller';
import { ContractEventLog, ReconciliationAlert } from './entities';
import { CacheModule } from '../cache/cache.module';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { PayLink } from '../paylink/entities/paylink.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContractEventLog, ReconciliationAlert, User, Transaction, PayLink]),
    BullModule.registerQueue({ name: 'blockchain-sync' }),
    CacheModule,
  ],
  providers: [SorobanService, ContractEventListenerService],
  controllers: [SorobanAdminController],
  exports: [SorobanService, ContractEventListenerService],
})
export class SorobanModule {}
