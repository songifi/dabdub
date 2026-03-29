import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { PayLink } from '../paylink/entities/pay-link.entity';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Transaction, PayLink])],
  providers: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}
