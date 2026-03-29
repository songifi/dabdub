import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Transfer } from './entities/transfer.entity';
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
import { COMPLIANCE_QUEUE } from '../compliance/compliance.service';
import { FeesModule } from '../fees/fees.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transfer, Transaction]),
    BullModule.registerQueue({ name: TRANSFER_QUEUE }),
    BullModule.registerQueue({ name: COMPLIANCE_QUEUE }),
    SorobanModule,
    NotificationsModule,
    UsersModule,
    TierConfigModule,
    WsModule,
    EmailModule,
    PinModule,
    FeesModule,
  ],
  controllers: [TransfersController],
  providers: [TransfersService, TransferProcessor],
  exports: [TransfersService],
})
export class TransfersModule {}
