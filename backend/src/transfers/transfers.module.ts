import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Transfer } from './entities/transfer.entity';
import { FeeConfig } from '../fee-config/entities/fee-config.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransfersService, TRANSFER_QUEUE } from './transfers.service';
import { TransfersController } from './transfers.controller';
import { TransferProcessor } from './processors/transfer.processor';
import { SorobanModule } from '../soroban/soroban.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { TierConfigModule } from '../tier-config/tier-config.module';
import { WsModule } from '../ws/ws.module';
import { EmailModule } from '../email/email.module';
import { PinModule } from '../pin/pin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transfer, FeeConfig, Transaction]),
    BullModule.registerQueue({ name: TRANSFER_QUEUE }),
    SorobanModule,
    NotificationsModule,
    UsersModule,
    TierConfigModule,
    WsModule,
    EmailModule,
    PinModule,
  ],
  controllers: [TransfersController],
  providers: [TransfersService, TransferProcessor],
  exports: [TransfersService],
})
export class TransfersModule {}
