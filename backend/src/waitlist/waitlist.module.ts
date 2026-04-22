import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaitlistService } from './waitlist.service';
import { WaitlistController } from './waitlist.controller';
import { WaitlistEntry } from './entities/waitlist.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WaitlistEntry])],
  controllers: [WaitlistController],
  providers: [WaitlistService],
})
export class WaitlistModule {}
