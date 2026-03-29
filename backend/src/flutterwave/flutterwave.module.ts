import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FlutterwaveService } from './flutterwave.service';
import { FlutterwaveController } from './flutterwave.controller';

@Module({
  imports: [HttpModule],
  providers: [FlutterwaveService],
  controllers: [FlutterwaveController],
  exports: [FlutterwaveService],
})
export class FlutterwaveModule {}
