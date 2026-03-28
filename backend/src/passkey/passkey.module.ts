import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasskeyController } from './passkey.controller';
import { PasskeyService } from './passkey.service';
import { PasskeyCredential } from './entities/passkey-credential.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../cache/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PasskeyCredential, User]),
    AuthModule,
    RedisModule,
  ],
  controllers: [PasskeyController],
  providers: [PasskeyService],
  exports: [PasskeyService],
})
export class PasskeyModule {}
