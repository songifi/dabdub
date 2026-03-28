import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsernameService } from './username.service';
import { UsernameController } from './username.controller';
import { UsernameHistory } from './entities/username-history.entity';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { SorobanModule } from '../soroban/soroban.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UsernameHistory, Wallet]),
    SorobanModule,
  ],
  controllers: [UsernameController],
  providers: [UsernameService],
  exports: [UsernameService],
})
export class UsernameModule {}
