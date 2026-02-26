import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Split } from '../entities/split.entity';
import { Participant } from '../entities/participant.entity';
import { CleanupScheduler } from './cleanup.scheduler';
import { SoftDeleteService } from './soft-delete.service';
import { RestoreController } from './restore.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Split, Participant])],
  controllers: [RestoreController],
  providers: [CleanupScheduler, SoftDeleteService],
  exports: [SoftDeleteService],
})
export class CommonModule {}
