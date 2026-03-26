import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '../../config/jwt.config';
import { Admin } from '../entities/admin.entity';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthController } from './admin-auth.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin]),
    AuthModule,
    JwtModule.registerAsync({
      inject: [jwtConfig.KEY],
      useFactory: (jwt: ConfigType<typeof jwtConfig>) => ({
        secret: jwt.accessSecret,
        signOptions: { expiresIn: jwt.accessExpiry as any },
      }),
    }),
  ],
  providers: [AdminAuthService],
  controllers: [AdminAuthController],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
