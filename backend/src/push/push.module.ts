import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DeviceToken } from './entities/device-token.entity';
import { FirebaseService } from './firebase.service';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { firebaseConfig, webPushConfig } from '../config';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceToken]),
    ConfigModule.forFeature(firebaseConfig),
    ConfigModule.forFeature(webPushConfig),
  ],
  controllers: [PushController],
  providers: [FirebaseService, PushService],
  exports: [PushService],
})
export class PushModule {}
