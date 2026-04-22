import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RatesService } from './rates.service';

@Module({
  imports: [HttpModule],
  providers: [RatesService],
  exports: [RatesService],
})
export class RatesModule {}
