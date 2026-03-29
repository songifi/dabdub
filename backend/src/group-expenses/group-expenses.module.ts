import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupExpense } from './entities/group-expense.entity';
import { ExpenseSplit } from './entities/expense-split.entity';
import { GroupExpensesService } from './group-expenses.service';
import { GroupExpensesController } from './group-expenses.controller';
import { GroupsModule } from '../groups/groups.module';
import { UsersModule } from '../users/users.module';
import { TransfersModule } from '../transfers/transfers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupExpense, ExpenseSplit]),
    GroupsModule,
    UsersModule,
    TransfersModule,
    NotificationsModule,
    WsModule,
  ],
  providers: [GroupExpensesService],
  controllers: [GroupExpensesController],
  exports: [GroupExpensesService],
})
export class GroupExpensesModule {}
