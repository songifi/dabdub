import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeeConfig } from '../fee-config/entities/fee-config.entity';
import { AdminFeesController } from './admin-fees.controller';
import { FeeRecord } from './entities/fee-record.entity';
import { FeesService } from './fees.service';

@Module({
  imports: [TypeOrmModule.forFeature([FeeConfig, FeeRecord])],
  controllers: [AdminFeesController],
  providers: [FeesService],
  exports: [FeesService],
})
export class FeesModule {}
