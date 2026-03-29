import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '../cache/cache.module';
import { FeatureFlag } from './entities/feature-flag.entity';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { FeatureFlagAdminController } from './feature-flag-admin.controller';
import { FeatureFlagMeController } from './feature-flag-me.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlag]), CacheModule],
  controllers: [FeatureFlagAdminController, FeatureFlagMeController],
  providers: [FeatureFlagService, FeatureFlagGuard],
  exports: [FeatureFlagService, FeatureFlagGuard],
})
export class FeatureFlagModule {}
