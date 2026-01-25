import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Settlement } from './entities/settlement.entity';
import { SettlementRepository } from './repositories/settlement.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Settlement])],
  providers: [SettlementRepository],
  exports: [SettlementRepository, TypeOrmModule],
})
export class SettlementModule {}
