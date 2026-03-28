import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';
import { LoginHistory, SecurityAlert, TrustedDevice } from './entities';
import { User } from '../users/entities/user.entity';
import { Session } from '../auth/entities/session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LoginHistory, SecurityAlert, TrustedDevice, User, Session])],
  providers: [SecurityService],
  controllers: [SecurityController],
  exports: [SecurityService],
})
export class SecurityModule {}
