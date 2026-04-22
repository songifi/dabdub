import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import { jwtConfig } from '../config/jwt.config';
import { CheeseGateway } from './cheese.gateway';
import { WsAdminController } from './ws-admin.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [jwtConfig.KEY],
      useFactory: (jwt: ConfigType<typeof jwtConfig>) => ({
        secret: jwt.accessSecret,
      }),
    }),
  ],
  providers: [CheeseGateway],
  controllers: [WsAdminController],
  exports: [CheeseGateway],
})
export class WsModule {}
