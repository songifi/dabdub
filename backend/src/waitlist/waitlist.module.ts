import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import { WaitlistService } from './waitlist.service';
import { WaitlistController } from './waitlist.controller';
import { EmailModule } from '../email/email.module';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaitlistEntry]),
    EmailModule,
    WsModule,
  ],
  providers: [WaitlistService],
  controllers: [WaitlistController],
  exports: [WaitlistService],
})
export class WaitlistModule {}
