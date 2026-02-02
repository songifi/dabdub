import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainNetwork } from './entities/blockchain-network.entity';
import { BlockchainBlockCursor } from './entities/blockchain-block-cursor.entity';
import { PaymentRequest } from './entities/payment-request.entity';
import { BlockchainMonitoringService } from './services/blockchain-monitoring.service';
import { StellarClientService } from './services/stellar-client.service';
import { StacksService } from './services/stacks.service';
import { StacksClientService } from './services/stacks-client.service';
import { BlockchainMonitoringJob } from './jobs/blockchain-monitoring.job';
import { BlockchainMonitoringController } from './controllers/blockchain-monitoring.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BlockchainNetwork,
      BlockchainBlockCursor,
      PaymentRequest,
    ]),
  ],
  controllers: [BlockchainMonitoringController],
  providers: [
    BlockchainMonitoringService,
    StellarClientService,
    StacksService,
    StacksClientService,
    BlockchainMonitoringJob,
  ],
  exports: [
    BlockchainMonitoringService,
    BlockchainMonitoringJob,
    StacksService,
  ],
})
export class BlockchainModule { }
