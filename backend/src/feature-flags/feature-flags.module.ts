import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController, AdminFeatureFlagsController } from './feature-flags.controller';
import { FeatureFlag } from './entities/feature-flag.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlag, User])],
  providers: [FeatureFlagsService],
  controllers: [FeatureFlagsController, AdminFeatureFlagsController],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
