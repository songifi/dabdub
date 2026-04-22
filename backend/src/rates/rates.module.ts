import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RatesService } from './rates.service';
import { RateSnapshot } from './entities/rate-snapshot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RateSnapshot])],
  providers: [RatesService],
  exports: [RatesService],
})
export class RatesModule {}
