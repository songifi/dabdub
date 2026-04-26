import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuntimeConfig } from './entities/runtime-config.entity';
import { RuntimeConfigService } from './runtime-config.service';
import { RuntimeConfigController } from './runtime-config-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RuntimeConfig])],
  providers: [RuntimeConfigService],
  controllers: [RuntimeConfigController],
  exports: [RuntimeConfigService],
})
export class RuntimeConfigModule {}
