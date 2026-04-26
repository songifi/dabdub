import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAlertController } from './admin-alert.controller';
import { AdminAlert } from './admin-alert.entity';
import { AdminAlertService } from './admin-alert.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdminAlert])],
  controllers: [AdminAlertController],
  providers: [AdminAlertService],
  exports: [AdminAlertService],
})
export class AdminAlertModule {}
