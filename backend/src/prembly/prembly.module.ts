import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PremblyService } from './prembly.service';

@Module({
  imports: [HttpModule],
  providers: [PremblyService],
  exports: [PremblyService],
})
export class PremblyModule {}
