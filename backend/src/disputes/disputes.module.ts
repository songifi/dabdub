import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispute } from './entities/dispute.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { DisputeService } from './dispute.service';
import { DisputeController } from './dispute.controller';
import { SorobanModule } from '../soroban/soroban.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupportModule } from '../support/support.module';
import { DisputeAdminGuard } from './guards/dispute-admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispute, Transaction, User, Wallet]),
    SorobanModule,
    NotificationsModule,
    SupportModule,
  ],
  providers: [DisputeService, DisputeAdminGuard],
  controllers: [DisputeController],
  exports: [DisputeService],
})
export class DisputesModule {}
