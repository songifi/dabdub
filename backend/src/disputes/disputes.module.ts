import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispute } from './entities/dispute.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { DisputeService } from './dispute.service';
import { DisputeController } from './dispute.controller';
import { SorobanModule } from '../soroban/soroban.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispute, Transaction, User]),
    SorobanModule,
    NotificationsModule,
  ],
  providers: [DisputeService],
  controllers: [DisputeController],
  exports: [DisputeService],
})
export class DisputesModule {}
