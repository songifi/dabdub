import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { VirtualCard } from './entities/virtual-card.entity';
import { VirtualCardService } from './virtual-card.service';
import { VirtualCardController } from './virtual-card.controller';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { SorobanModule } from '../soroban/soroban.module';
import { RatesModule } from '../rates/rates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VirtualCard, User, Transaction]),
    HttpModule,
    SorobanModule,
    RatesModule,
  ],
  providers: [VirtualCardService],
  controllers: [VirtualCardController],
  exports: [VirtualCardService],
})
export class VirtualCardsModule {}
