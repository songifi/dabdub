import { Module } from '@nestjs/common';
import { RedisModule } from 'nestjs-redis';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { Session } from './session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session]),
    RedisModule.forRoot({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}