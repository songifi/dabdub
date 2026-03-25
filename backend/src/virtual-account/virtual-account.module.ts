import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { VirtualAccount } from './entities/virtual-account.entity';
import { VirtualAccountService } from './virtual-account.service';
import { VirtualAccountController } from './virtual-account.controller';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VirtualAccount]),
    HttpModule,
    WsModule,
  ],
  providers: [VirtualAccountService],
  controllers: [VirtualAccountController],
  exports: [VirtualAccountService],
})
export class VirtualAccountModule {}
