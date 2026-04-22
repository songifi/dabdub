import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { VirtualAccount } from './entities/virtual-account.entity';
import { VirtualAccountService } from './virtual-account.service';
import { VirtualAccountController } from './virtual-account.controller';
import { WsModule } from '../ws/ws.module';
import { RatesModule } from '../rates/rates.module';
import { SorobanModule } from '../soroban/soroban.module';
import { DepositsModule } from '../deposits/deposits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VirtualAccount]),
    HttpModule,
    WsModule,
    RatesModule,
    SorobanModule,
    DepositsModule,
  ],
  providers: [VirtualAccountService],
  controllers: [VirtualAccountController],
  exports: [VirtualAccountService],
})
export class VirtualAccountModule {}
